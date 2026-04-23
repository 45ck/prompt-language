const fs = require('fs');

// Parse CSV with quoted-comma handling
function parseCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.trim().split('\n');
  const headers = lines[0].split(',');
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    let currentField = '';
    let inQuote = false;
    let fields = [];
    let currentCharIndex = 0;

    while (currentCharIndex < line.length) {
      const char = line[currentCharIndex];

      if (char === '"') {
        inQuote = !inQuote;
        currentField += char;
        currentCharIndex++;
      } else if (char === ',' && !inQuote) {
        fields.push(currentField);
        currentField = '';
        currentCharIndex++;
      } else if (char === '\r' || char === '\n') {
        currentCharIndex++;
      } else {
        currentField += char;
        currentCharIndex++;
      }
    }

    // Add the last field
    if (currentField) {
      fields.push(currentField);
    }

    // Replace empty strings with null
    fields = fields.map((field) => (field === '' ? null : field));

    // Pad with nulls if fewer fields than headers
    while (fields.length < headers.length) {
      fields.push(null);
    }

    data.push(fields);
  }

  return data;
}

// Main logic
if (process.argv.length < 3) {
  console.error('Usage: node csv2json.js <file.csv>');
  process.exit(1);
}

const filePath = process.argv[2];

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

if (fs.readFileSync(filePath, 'utf8').trim().length === 0) {
  console.error('Error: Empty file');
  process.exit(1);
}

const data = parseCSV(filePath);
const headers = data[0];
const rows = data.slice(1);

const result = rows.map((row) => {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i];
  }
  return obj;
});

console.log(JSON.stringify(result, null, 2));
process.exit(0);
