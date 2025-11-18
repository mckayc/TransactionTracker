import React, { useState, useRef, useEffect } from 'react';
import { getAiFinancialAnalysis } from '../services/geminiService';
import { ChatBubbleIcon, CloseIcon, SendIcon } from './Icons';

interface ChatbotProps {
    contextData: object;
}

interface Message {
    role: 'user' | 'ai';
    content: string;
}

const Chatbot: React.FC<ChatbotProps> = ({ contextData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);
    
    useEffect(() => {
        if(isOpen) {
             setMessages([{ role: 'ai', content: "Hello! How can I help you analyze your finances today? You can ask things like 'How much did I spend on groceries this month?' or 'What are my top 3 expense categories?'" }]);
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const stream = await getAiFinancialAnalysis(input, contextData);
            
            let fullResponse = '';
            setMessages(prev => [...prev, { role: 'ai', content: '' }]);

            for await (const chunk of stream) {
                const chunkText = chunk.text;
                fullResponse += chunkText;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { role: 'ai', content: fullResponse };
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Chatbot error:", error);
            const errorMessage: Message = { role: 'ai', content: "Sorry, I encountered an error. Please try again." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 bg-indigo-600 text-white rounded-full p-4 shadow-lg hover:bg-indigo-700 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 z-50"
                aria-label={isOpen ? "Close chat" : "Open chat"}
            >
                {isOpen ? <CloseIcon className="w-8 h-8"/> : <ChatBubbleIcon className="w-8 h-8" />}
            </button>
            
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-[calc(100vw-3rem)] max-w-md h-[70vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-200">
                    <header className="p-4 bg-slate-50 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800">Financial AI Assistant</h2>
                    </header>

                    <main className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-lg' : 'bg-slate-100 text-slate-800 rounded-bl-lg'}`}>
                                    <div className="prose prose-sm" dangerouslySetInnerHTML={{__html: msg.content.replace(/\n/g, '<br/>')}}/>
                                </div>
                            </div>
                        ))}
                         {isLoading && (
                            <div className="flex justify-start">
                                <div className="max-w-[80%] p-3 rounded-2xl bg-slate-100 text-slate-800 rounded-bl-lg">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-0"></span>
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-300"></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </main>

                    <footer className="p-4 bg-slate-50 border-t border-slate-200">
                        <div className="flex items-center gap-2">
                             <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Ask a financial question..."
                                className="flex-1"
                                disabled={isLoading}
                                aria-label="Chat input"
                            />
                            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-indigo-600 text-white rounded-lg p-3 disabled:bg-slate-400 hover:bg-indigo-700 transition-colors" aria-label="Send message">
                                <SendIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    </footer>
                </div>
            )}
        </>
    );
};

export default Chatbot;
