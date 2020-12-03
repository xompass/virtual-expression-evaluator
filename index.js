const math = require('mathjs');
const utils = require('./utils');


exports.parseAndCompileExpression = parseAndCompileExpression;
exports.groupDataByVariable = groupDataByVariable;
exports.evaluate = evaluate;

/**
 *
 * @param expression
 * @returns Object.<expressionVariable, {{id: string, path: string}}>
 */
function parseAndCompileExpression(expression) {
  if (!expression) {
    throw new Error('Empty expression');
  }

  const parsed = math.parse(expression);
  const variables = {};
  parsed.filter((node, path) => {
    if (node.isSymbolNode && path !== 'fn') {
      const name = node.name.startsWith('$') ? node.name.substring(1) : node.name;
      const parts = name.split('$');
      const id = parts[0]; // The first part is the virtual variable id
      if (!variables[node.name]) {
        variables[node.name] = {
          name: node.name,
          id: id,
          path: parts.slice(1),
        };
      }
    }
  });

  return {variables, parsed, compiled: parsed.compile()};
}

function groupDataByVariable(variables, virtualVariables, summaries) {
  const variablesBySensorId = Object.values(variables).reduce((hash, current) => {
    hash[current.sensorId] = hash[current.sensorId] || [];
    hash[current.sensorId].push(current);
    return hash;
  }, {});

  const result = {};
  summaries.forEach(summary => {
    const sensorId = summary.sensorId;
    const variables = variablesBySensorId[sensorId];
    if (!variables) {
      return;
    }

    for (let i = 0; i < 24; i++) {
      const time = new Date(summary.from.getTime());
      time.setHours(i);

      for (let variable of variables) {
        result[variable.name] = result[variable.name] || [];
        const path = variable.path.join('.');
        const value = utils.getObjectValue(summary[i], path);
        result[variable.name][time.getTime()] = utils.isValidNumber(value) ? value : 0;
      }
    }
  });

  return result;
}


/**
 *
 * @param expression result of parseAndCompileExpression
 * @param from
 * @param virtualVariables
 * @param to
 * @param summaries
 */
function evaluate(expression, virtualVariables, from, to, summaries) {
  const parsedExpression = parseAndCompileExpression(expression);
  const variables = parsedExpression.variables;
  const compiled = parsedExpression.compiled;

  Object.values(variables).forEach(variable => {
    const virtualVariable = virtualVariables.find(current => current.id.toString() === variable.id.toString());
    variable.sensorId = virtualVariable ? virtualVariable.sensorId : null;
    variable.defaultValue = virtualVariable ? virtualVariable.value : null;
  });

  const groupedData = groupDataByVariable(variables, virtualVariables, summaries);
  let result = {};
  for (let timestamp = from.getTime(); timestamp < to.getTime(); timestamp += 60 * 60 * 1000) {
    let hour = new Date(timestamp).getTime();

    let scope = {};
    for (let [node, variable] of Object.entries(variables)) {
      const data = groupedData[node];
      let hourValue = data ? data[hour] : null;
      if (hourValue == null) {
        hourValue = variable.defaultValue;
      }

      if (utils.isValidNumber(hourValue)) {
        scope[node] = hourValue;
      }
    }

    if (Object.keys(scope).length === Object.keys(variables).length) {
      let evaluated = compiled.evaluate(scope);
      result[hour] = {time: hour, value: utils.isValidNumber(evaluated) ? evaluated : null};
    } else {
      result[hour] = {time: hour, value: null};
    }
  }
  result = Object.values(result);
  return result.filter(current => {
    current.from = new Date(current.time);
    current.to = new Date(current.time);
    current.to.setMinutes(59, 59, 999);
    delete current.time;
    return current.from.getTime() >= from.getTime() && current.from.getTime() < to.getTime();
  });
}