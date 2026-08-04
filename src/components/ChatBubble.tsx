import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, Paperclip, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { registrarPreguntaSinRespuesta } from '@/hooks/useChatbotConocimiento';
import { Link } from 'react-router-dom';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-gesbase`;

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function extractFileContent(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  // Text-based files
  if (name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.xml')) {
    return await readFileAsText(file);
  }

  // PDF: extract text client-side using pdf.js-like approach via text layer
  if (name.endsWith('.pdf')) {
    // For PDFs, we read as array buffer and send raw text extraction
    const arrayBuffer = await file.arrayBuffer();
    // Simple PDF text extraction - look for text streams
    const uint8 = new Uint8Array(arrayBuffer);
    const text = extractTextFromPDFBytes(uint8);
    if (text.trim().length > 50) return text;
    // Fallback: inform user
    return `[Archivo PDF subido: ${file.name} - No se pudo extraer texto automáticamente. Por favor, copia y pega el contenido del documento.]`;
  }

  // Fallback for other files
  try {
    return await readFileAsText(file);
  } catch {
    return `[Archivo subido: ${file.name} - Formato no soportado para extracción de texto. Por favor, copia y pega el contenido.]`;
  }
}

function extractTextFromPDFBytes(bytes: Uint8Array): string {
  // Simple PDF text extraction - decode the byte stream and find text between parentheses in Tj/TJ operators
  const raw = new TextDecoder('latin1').decode(bytes);
  const textParts: string[] = [];

  // Method 1: Extract text from stream content between BT...ET blocks
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    // Find text in parentheses followed by Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textParts.push(tjMatch[1]);
    }
    // Find text arrays in TJ operator
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let arrMatch;
    while ((arrMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = arrMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(inner)) !== null) {
        textParts.push(strMatch[1]);
      }
    }
  }

  // Clean up escape sequences
  return textParts
    .join(' ')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ El archivo es demasiado grande (máximo 10MB). Prueba con un archivo más pequeño o copia el contenido directamente.' }]);
      return;
    }

    setExtracting(true);
    try {
      const content = await extractFileContent(file);
      setAttachedFile({ name: file.name, content });
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ No se pudo leer el archivo. Prueba copiando y pegando el contenido.' }]);
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Debes iniciar sesión para usar el asistente.');
    }
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messages: allMessages }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Error de conexión' }));
      throw new Error(err.error || `Error ${resp.status}`);
    }
    if (!resp.body) throw new Error('No stream body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantSoFar = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') { streamDone = true; break; }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            const snapshot = assistantSoFar;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
              }
              return [...prev, { role: 'assistant', content: snapshot }];
            });
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !attachedFile) || isLoading) return;

    // Build the message content
    let userContent = text;
    let displayContent = text;

    if (attachedFile) {
      const filePrefix = `📎 **${attachedFile.name}**\n\n`;
      displayContent = filePrefix + (text || 'Analiza este documento');
      userContent = `[ARCHIVO ADJUNTO: ${attachedFile.name}]\n\nContenido del archivo:\n---\n${attachedFile.content}\n---\n\n${text || 'Analiza este documento y dime qué acciones de vigilancia puedo planificar según los horarios que aparecen.'}`;
      setAttachedFile(null);
    }

    const userMsg: Msg = { role: 'user', content: userContent };
    const displayMsg: Msg = { role: 'user', content: displayContent };
    const newMessages = [...messages, userMsg];

    // Show display version in UI
    setMessages(prev => [...prev, displayMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Send full content version to AI
      await streamChat(newMessages);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.txt,.csv,.md,.json,.xml,.doc,.docx"
        onChange={handleFileSelect}
      />

      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
          aria-label="Abrir asistente"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[550px] max-h-[calc(100vh-4rem)] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-semibold text-sm">Asistente GesBase</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground hover:bg-primary/80"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8 space-y-3">
                <Bot className="w-10 h-10 mx-auto text-primary/40" />
                <p className="font-medium">¡Hola! Soy tu asistente GesBase</p>
                <p className="text-xs">
                  Pregúntame sobre procesos SGS, certificaciones, o sube la programación de servicio de un maquinista para sugerirte acciones.
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                  {[
                    '¿Qué es el PE 12.01?',
                    '¿Cómo creo un expediente?',
                    '¿Dónde veo las alertas?',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="text-xs px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attached file indicator */}
          {attachedFile && (
            <div className="px-3 py-1.5 border-t bg-muted/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate flex-1">{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="text-destructive hover:text-destructive/80">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {extracting && (
            <div className="px-3 py-1.5 border-t bg-muted/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Extrayendo contenido del archivo...</span>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t px-3 py-2">
            <div className="flex items-end gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || extracting}
                title="Adjuntar archivo (PDF, TXT, CSV...)"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu consulta..."
                rows={1}
                className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary max-h-24"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleSend}
                disabled={(!input.trim() && !attachedFile) || isLoading}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
