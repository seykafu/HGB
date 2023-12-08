'use client';
import Image from 'next/image'
import { OpenAI } from 'openai';
import { useState, useEffect, createServerContext } from "react";
import fs from 'fs';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import axios from 'axios';
import TypingAnimation from "./components/TypingAnimation";

const inter = Inter({ subsets: ['latin']})

//const fs = require('fs').promises;

async function readFile(filePath) {
  try {
    const data = await fs.readFile(filePath);
    console.log(data.toString());
  } catch (error) {
    console.error(`Got an error trying to read the file: ${error.message}`);
  }
}

readFile('gcc.pdf');

export default function Home() {
  const [InputValue, setInputValue] = useState<string>('')
  const [chatLog, setChatLog] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setChatLog((prevChatLog) => [...prevChatLog, { type: 'user', message: InputValue }])

    sendMessage(InputValue);

    setInputValue('');
  };

  const sendMessage = (message) => {
    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      'Content-type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
    };

    const openai = new OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });    

    const data = {
      model: "gpt-4-1106-preview",
      messages: [
        {"role": "user", "content": message },
        {"role": "system", "content": "You're a Copilot called Paralogue, an AI assitant that's designed to help people who have cool story ideas for games but don't know how to get started. Always make sure to only answer questions related to game development, narrative design, and how any aspiring game dev can get started for newbies. Keep all responses to 250 words or less."},
        {"role": "assistant", "content": "And who might you be?"}
      ]
    };

    // const assistant = openai.beta.assistants.retrieve(
    //   "asst_Y5kEUso72So31xUJWSp0ky5z"
    // );

    try {
      const response = fetch('/api/uploadFile', { method: 'POST' });
      const data = response.json();

    // Upload a file with an "assistants" purpose
    const file = openai.files.create({
      file: fs.createReadStream("gcc.pdf"),
      purpose: "assistants",
    });

    // Create an assistant using the file ID
    const assistant = openai.beta.assistants.create({
      instructions: "You are a helpful assistant for Paralogue, a Copilot designed to help aspiring indie game developers get the ground running in turning their story ideas into life.",
      model: "gpt-4-1106-preview",
      tools: [{"type": "retrieval"}],
      file_ids: ["file-gkou77t5ExZfu2C5WaTK2eEm"]
    });

    console.log(assistant);

    // Threads
    const thread = openai.beta.threads.create();

    const assisant_message = openai.beta.threads.messages.create("thread_S9IwKhjwZya8xAaQxdO9kW4e", {
      role: "user",
      content: "What is the meaning of life?"
    });

    // Run assistant
    const run = openai.beta.threads.runs.create("thread_S9IwKhjwZya8xAaQxdO9kW4e", {
    assistant_id: "asst_Y5kEUso72So31xUJWSp0ky5z",
    instructions: "Address the user as Kasey",
    }); 

  } catch (error) {
    console.error(error);
  }

    // const run = openai.beta.threads.runs.retrieve(
    //   "run_1Y5kF0s7o72So31xUJWSp0ky5z",
    //   "thread_S9IwKhjwZya8xAaQxdO9kW4e"
    // )

    // console.log(run);

    // const messages = openai.beta.threads.messages.list(
    //   "thread_S9IwKhjwZya8xAaQxdO9kW4e"
    // );

    // messages.body.data.forEach((message) => {
    //   console.log(message.content);
    //   });

      const logs = openai.beta.threads.runs.steps.list(
        "thread_S9IwKhjwZya8xAaQxdO9kW4e",
        "run_fFSwJaLcZcp6HyIhg6Mm0LiA"
      );

    console.log(logs);

    setIsLoading(true);

    axios.post(url, data, { headers: headers })
      .then((response) => {
        console.log(response);
        setChatLog((prevChatLog) => [...prevChatLog, { type: 'bot', message: response.data.choices[0].message.content }]);
        setIsLoading(false);
      })
      .then((assistant) => {
        console.log(assistant);
      })
      .catch((error) => {
        console.log(error);
        setIsLoading(false);
      });

    const [message, setMessage] = useState('');

  return (
    <div className="container mx-auto max-w-[700px]">
      <div className="flex flex-col h-screen bg-gray-900"> 
      <h1 className="bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text text-center py-3 font-bold text-6xl">Paralogue</h1>
      <div className="flex-grow p-6">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col-reverse space-y-4">
            {
              chatLog.map((message, index) => (
                <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center justify-center px-4 py-2 rounded-lg ${message.type === 'user' ? 'bg-blue-500' : 'bg-gray-700'}`}>
                      <p 
                      className={`text-sm ${message.type === 'user' ? 'text-white' : 'text-gray-200'}`}>{message.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            }

            {
              isLoading &&
              <div key={chatLog.length} className="flex justify-start">
                <div className="bg-gray-800 rounded-lg p-4 text-white max-w-sm">
                  <TypingAnimation />
                </div>
              </div>
            }
    
          </div>
        </div>
      </div>

      {/*
        chatLog.map((message, index) => (
          <div key="index">{message.message}</div>
        ))
        */} 

      

      <form onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(message);
        setMessage(''); // clear the message input after submit
      }} className="flex-none p-6">
        <div className='flex rounded-lg border border-gray-700 bg-gray-800'>
        <textarea 
          className="flex-grow px-4 py-2 bg-transparent text-white focus:outline-none" 
          placeholder='Type your question!'
          rows={1} 
          style={{resize: 'none', overflow: 'hidden'}}
          value={InputValue}
          onChange={e => setInputValue(e.target.value)}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = (e.target.scrollHeight) + 'px';
          }}
          onKeyPress={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        </div>
        <button type="submit" className="bg-purple-500 rounded-lg px-4 py-2 text-white font-semibold focus:outline-none hover:bg-purple-600 transition-colors duration-300">
          Send
        </button>
      </form>
      <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
      </div>
    </div>
  )
}
};
