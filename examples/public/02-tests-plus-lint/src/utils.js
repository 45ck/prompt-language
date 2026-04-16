// Correct logic, but lint violations everywhere.

var capitalize = function (str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

var unused = 42;

function greet(name) {
  return capitalize('hello ') + name;
}

module.exports = { capitalize, greet };
