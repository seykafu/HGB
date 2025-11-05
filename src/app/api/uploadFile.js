// pages/api/uploadFile.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs';
import { OpenAI } from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const file = await openai.files.create({
      file: fs.createReadStream("gcc.pdf"),
      purpose: "assistants",
    });

    const assistant = await openai.beta.assistants.create({
      // ... your code here ...
    });

    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}