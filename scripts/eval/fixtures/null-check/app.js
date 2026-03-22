// User utilities
function getDisplayName(user) {
  return user.firstName + ' ' + user.lastName;
}

function getInitials(user) {
  return user.firstName[0] + user.lastName[0];
}

module.exports = { getDisplayName, getInitials };
