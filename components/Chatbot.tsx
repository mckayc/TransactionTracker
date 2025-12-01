
import React, { useState, useRef, useEffect } from 'react';
import { getAiFinancialAnalysis } from '../services/geminiService';
import { ChatBubbleIcon, CloseIcon, SendIcon } from './Icons';

interface ChatbotProps {
    contextData: object;
    isOpen: boolean;
    onClose: () => void;
}

interface Message {
    role: 'user' | 'ai';
    content: string;
}

const Chatbot: React.FC<ChatbotProps> = ({ contextData, isOpen, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);
    
    // Initial greeting when opened
    useEffect(() => {
        if(isOpen && messages.length === 0) {
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

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 w-[calc(100vw-2rem)] max-w-md h-[70vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-200 animate-slide-up">
            <header className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2 text-indigo-700">
                    <ChatBubbleIcon className="w-5 h-5"/>
                    <h2 className="text-lg font-bold text-slate-800">AI Assistant</h2>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200">
                    <CloseIcon className="w-5 h-5" />
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-lg' : 'bg-slate-100 text-slate-800 rounded-bl-lg'}`}>
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
                        placeholder="Ask a question..."
                        className="flex-1"
                        disabled={isLoading}
                        autoFocus
                        aria-label="Chat input"
                    />
                    <button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-indigo-600 text-white rounded-lg p-3 disabled:bg-slate-400 hover:bg-indigo-700 transition-colors" aria-label="Send message">
                        <SendIcon className="w-5 h-5"/>
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default Chatbot;
