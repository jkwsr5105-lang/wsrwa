// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { parse } = require('csv-parse');
const formidable = require('formidable');
const pLimit = require('p-limit');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 4000;
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const TEMPLATE_NAME = process.env.TEMPLATE_NAME;
const TEMPLATE_LANG = process.env.TEMPLATE_LANG || 'en_US';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '40', 10);
const RETRY_LIMIT = parseInt(process.env.RETRY_LIMIT || '3', 10);
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'verify_token';

if (!TOKEN || !PHONE_NUMBER_ID || !TEMPLATE_NAME) {
  console.error('Missing WHATSAPP_TOKEN, PHONE_NUMBER_ID or TEMPLATE_NAME in .env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

// Simple UI: upload CSV form and status
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui.html'));
});

// Upload endpoint (multipart form with CSV file)
// CSV expected: phone,message_param1,message_param2,...   (first column must be E.164 phone number, e.g. +919812345678)
app.post('/upload', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'file parse error', details: err.message });
    const file = files.csv;
    if (!file) return res.status(400).json({ error: 'CSV file field must be named "csv"' });

    const records = [];
    fs.createReadStream(file.filepath)
      .pipe(parse({ trim: true }))
      .on('data', row => {
        // ignore empty rows
        if (!row.length) return;
        // keep as array: [phone, p1, p2, ...]
        records.push(row);
      })
      .on('end', async () => {
        // Save a simple job file and return job id
        const jobId = `job_${Date.now()}`;
        const jobFile = path.join(__dirname, 'jobs', `${jobId}.json`);
        fs.mkdirSync(path.join(__dirname, 'jobs'), { recursive: true });
        fs.writeFileSync(jobFile, JSON.stringify({ id: jobId, total: records.length, status: 'queued', records }, null, 2));
        // start sending asynchronously (doesn't block HTTP response)
        sendJob(jobId, records).catch(e => console.error('Job error', e));
        res.json({ jobId, total: records.length, message: 'Job queued. Open /jobs/:id to view status.' });
      })
      .on('error', e => res.status(500).json({ error: 'CSV parse error', details: e.message }));
  });
});

// Simple job status endpoint
app.get('/jobs/:id', (req, res) => {
  const j = req.params.id;
  const file = path.join(__dirname, 'jobs', `${j}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'job not found' });
  const data = JSON.parse(fs.readFileSync(file));
  res.json(data);
});

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    return res.status(200).send(challenge);
  }
  res.status(403).send('Forbidden');
});

// Webhook receiver (POST)
app.post('/webhook', (req, res) => {
  // You must configure webhook in Meta App dashboard to point here
  console.log('Webhook received:', JSON.stringify(req.body).slice(0, 1000));
  // process events if needed (delivery, status, messages)
  res.sendStatus(200);
});

// Helper: update job file status
function updateJob(jobId, patch) {
  try {
    const file = path.join(__dirname, 'jobs', `${jobId}.json`);
    const job = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : { id: jobId, total: 0, records: [] };
    const merged = Object.assign({}, job, patch);
    fs.writeFileSync(file, JSON.stringify(merged, null, 2));
  } catch (e) {
    console.error('updateJob error', e);
  }
}

// send single template message
async function sendTemplate(phone, params = []) {
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANG },
      components: []
   
