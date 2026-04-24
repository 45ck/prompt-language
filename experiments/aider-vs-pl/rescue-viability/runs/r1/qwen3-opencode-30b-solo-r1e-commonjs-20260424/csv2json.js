const fs = require('fs');

const args = process.argv;
if (args.length < 3) {
  console.error('Error: Missing CSV file path');
  process.exit(1);
}

const csvPath = args[2];
if (!fs.existsSync(csvPath)) {
  console.error(`Error: File not found: ${csvPath}`);
  process.exit(1);
}

const fileContent = fs.readFileSync(csvPath, 'utf8');
if (fileContent.trim() === '') {
  console.error('Error: Empty file');
  process.exit(1);
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

const lines = fileContent.split('\n').filter((line) => line.trim() !== '');
const headers = parseCSVLine(lines[0]);
const data = [];

for (let i = 1; i < lines.length; i++) {
  const fields = parseCSVLine(lines[i]);
  const cleanedFields = fields.map((field) => (field === '' ? null : field));
  while (cleanedFields.length < headers.length) {
    cleanedFields.push(null);
  }
  const obj = {};
  for (let j = 0; j < headers.length; j++) {
    obj[headers[j]] = cleanedFields[j];
  }
  data.push(obj);
}

console.log(JSON.stringify(data, null, 2));
