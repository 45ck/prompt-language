const db = require('./database');

// LIST — bare catch swallows errors
function listContacts() {
  try {
    return { status: 200, body: db.findAll() };
  } catch (e) {
    // BUG: swallows error silently
    return { status: 200, body: [] };
  }
}

// GET — bare catch with only console.log
function getContact(id) {
  try {
    const parsed = parseInt(id, 10);
    const contact = db.findById(parsed);
    if (!contact) {
      return { status: 200, body: null }; // BUG: should be 404
    }
    return { status: 200, body: contact };
  } catch (e) {
    console.log(e); // BUG: logs but returns wrong status
    return { status: 200, body: null };
  }
}

// CREATE — swallows validation errors
function createContact(data) {
  try {
    const contact = db.create(data);
    return { status: 201, body: contact };
  } catch (e) {
    // BUG: returns 500 with raw error message, no structure
    return { status: 500, body: { message: e.message } };
  }
}

// UPDATE — no error handling at all
function updateContact(id, data) {
  const parsed = parseInt(id, 10);
  const contact = db.update(parsed, data);
  // BUG: no null check, crashes on missing contact
  return { status: 200, body: contact };
}

// DELETE — empty catch block
function deleteContact(id) {
  try {
    const parsed = parseInt(id, 10);
    db.remove(parsed);
    return { status: 204, body: null };
  } catch (e) {
    // BUG: completely swallowed
  }
  return { status: 204, body: null };
}

// SEARCH — catch returns misleading result
function searchContacts(query) {
  try {
    if (!query) throw new Error('Query required');
    const all = db.findAll();
    const matches = all.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
    return { status: 200, body: matches };
  } catch (e) {
    // BUG: returns 200 with empty array instead of proper error
    return { status: 200, body: [] };
  }
}

module.exports = {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  searchContacts,
};
