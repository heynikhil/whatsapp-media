const bodyParser = require('body-parser')
const extName = require('ext-name');
const fetch = require('node-fetch');
const express = require('express');
const config = require('./config');
const Twilio = require('twilio');
const urlUtil = require('url');
const path = require('path');
const fs = require('fs');
const app = express()
const PUBLIC_DIR = './public';
app.use(express.static('public'))

const { twilioPhoneNumber, twilioAccountSid, twilioAuthToken } = config;
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
let twilioClient;

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(path.resolve(PUBLIC_DIR));
}

function getTwilioClient() {
  return twilioClient || new Twilio(twilioAccountSid, twilioAuthToken);
}

function deleteMediaItem(mediaItem) {
  const client = getTwilioClient();
  return client
    .api.accounts(twilioAccountSid)
    .messages(mediaItem.MessageSid)
    .media(mediaItem.mediaSid).remove();
}

async function SaveMedia(mediaItem) {
  const { mediaUrl, filename } = mediaItem;
    const fullPath = path.resolve(`${PUBLIC_DIR}/${filename}`);
    if (!fs.existsSync(fullPath)) {
      const response = await fetch(mediaUrl);
      const fileStream = fs.createWriteStream(fullPath);
      response.body.pipe(fileStream);
      deleteMediaItem(mediaItem);
    }
}

async function handler(req, res) {
  const { body } = req;
  console.log(body);

  const { NumMedia, From: SenderNumber, MessageSid } = body;
  let saveOperations = [];
  const mediaItems = [];

  for (var i = 0; i < NumMedia; i++) {  // eslint-disable-line
    const mediaUrl = body[`MediaUrl${i}`];
    const contentType = body[`MediaContentType${i}`];
    const extension = extName.mime(contentType)[0].ext;
    console.log(extension);
    
    const mediaSid = path.basename(urlUtil.parse(mediaUrl).pathname);
    const filename = `${mediaSid}.${extension}`;

    mediaItems.push({ mediaSid, MessageSid, mediaUrl, filename });
    saveOperations = mediaItems.map(mediaItem => SaveMedia(mediaItem));
  }

  await Promise.all(saveOperations);

  const messageBody = NumMedia === '0' ? 'Send us an image or file!' : `Thanks for sending us ${NumMedia} file(s)`;

  const client = getTwilioClient();
  client.messages
    .create({
      from: twilioPhoneNumber,
      to: SenderNumber,
      body: messageBody,
      // mediaUrl:"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
      // mediaUrl:"http://crashtestdummy.com.au/wp-content/uploads/2010/12/crash-test-dummy-awards.jpg"
      // mediaUrl:"https://geekanddummy.com/wp-content/uploads/2014/02/central-locking-Ford-Mondeo-Mk-3.mp3"
    });

}


app.post('/', handler);
app.listen(3000, () => console.log(`Magic...Magic On => 3000!`))
