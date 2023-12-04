'use client';
import Image from 'next/image'
import { useState, useEffect, createServerContext } from "react";
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import axios from 'axios';

const inter = Inter({ subsets: ['latin']})

export default function Home() {
  const [InputValue, setInputValue] = useState<string>('')
  const [chatLog, setChatLog] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setChatLog((prevChatLog) => [...prevChatLog, { type: 'user', message: InputValue }])

    sendMessage(InputValue);

    setInputValue('');
  }

  const sendMessage = (message) => {
    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      'Content-type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
    };
    const data = {
      model: "gpt-4-1106-preview",
      messages: [
        {"role": "user", "content": message },
        {"role": "system", "content": "You're a Copilot called Paralogue, an AI assitant that's designed to help people who have cool story ideas for games but don't know how to get started. Always make sure to only answer questions related to game development, narrative design, and how any aspiring game dev can get started for newbies. Keep all responses to 250 words or less."},
        {"role": "assistant", "content": "And who might you be?"}
      ]
    };

    setIsLoading(true);

    axios.post(url, data, { headers: headers })
      .then((response) => {
        console.log(response);
        setChatLog((prevChatLog) => [...prevChatLog, { type: 'bot', message: response.data.choices[0].message.content }]);
        setIsLoading(false);
      })
      .catch((error) => {
        console.log(error);
        setIsLoading(false);
      });
  }

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
          </div>
        </div>
      </div>
      {
        chatLog.map((message, index) => (
          <div key="index">{message.message}</div>
        ))
      }
      <form onSubmit={handleSubmit}>
        <textarea 
          placeholder="Type your question..." 
          value={InputValue} 
          onChange={(e) => setInputValue(e.target.value)} 
          style={{ color: 'black', width: '700px', height: '100px'}}
        />
        <button type="submit">Send</button>
      </form>
      <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
      </div>
    </div>
  )
}
