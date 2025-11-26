require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname,'..','web')));

let messagesDB = [];
let autoReplies = [];

const upload = multer({ dest: 'uploads/' });
const TOKEN = process.env.WABA_TOKEN;
const PHONE_ID = process.env.WABA_PHONE_ID;
const PORT = process.env.PORT || 3000;

// Send message with template/variables
app.post('/api/send', async (req,res)=>{
  const { numbers, message, variables } = req.body;
  if(!numbers||!message) return res.status(400).json({error:'numbers & message required'});

  const results=[];
  for(const num of numbers){
    let msgText = message;
    if(variables && variables[num]){
      Object.keys(variables[num]).forEach(k=>{
        msgText = msgText.replace(new RegExp('{{'+k+'}}','g'), variables[num][k]);
      });
    }
    try{
      const resp = await axios.post(`https://graph.facebook.com/v17.0/${PHONE_ID}/messages`,{
        messaging_product:"whatsapp",
        to:num,
        type:"text",
        text:{body: msgText}
      },{ headers:{ Authorization:`Bearer ${TOKEN}` }});
      messagesDB.push({ id: resp.data.messages?.[0]?.id||uuidv4(), number:num, status:'sent', message: msgText });
      results.push({number:num, status:'sent'});
    }catch(e){
      results.push({number:num, status:'error', error:e.toString()});
    }
  }
  res.json({success:true, results});
});

// CSV upload
app.post('/api/upload-csv', upload.single('file'), async(req,res)=>{
  const results=[];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data)=>results.push(data))
    .on('end', ()=>{
      fs.unlinkSync(req.file.path);
      res.json({success:true, rows: results});
    });
});

// Media upload placeholder
app.post('/api/upload-media', upload.single('file'), (req,res)=>{
  res.json({success:true, file:req.file.filename, message:'Media stored (demo)'});
});

// Webhook
app.post('/webhook', (req,res)=>{
  console.log('Webhook event received:', req.body);
  res.sendStatus(200);
});

// Auto-reply
app.post('/api/auto-reply', (req,res)=>{
  const { keyword, reply } = req.body;
  autoReplies.push({ keyword, reply });
  res.json({ success:true, rules: autoReplies });
});

// Dashboard
app.get('/api/dashboard', (req,res)=>{
  res.json({ messages: messagesDB, autoReplies });
});

app.listen(PORT, ()=>console.log(`WABA SaaS running on ${PORT}`));
