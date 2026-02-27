import React, { useRef, useEffect } from 'react';

const ChatPanel = React.memo(function ChatPanel({
  messages,
  isTyping,
  inputValue,
  onInputChange,
  onSend,
  onFileUpload,
  placeholder = 'Type your message...',
  fileAccept = '.pdf,.doc,.docx,.txt,.csv,.xlsx,.pptx',
  headerContent,
  renderMessageContent,
}) {
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const defaultRenderMessage = (msg) => msg.content;

  const renderMsg = renderMessageContent || defaultRenderMessage;

  return (
    <div className="chat-window">
      {headerContent}

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.role === 'assistant' && <div className="message-avatar">S</div>}
            <div className="message-content">
              {renderMsg(msg)}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message assistant">
            <div className="message-avatar">S</div>
            <div className="message-content typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileUpload}
          style={{ display: 'none' }}
          accept={fileAccept}
          multiple
        />
        <button className="attach-btn" onClick={() => fileInputRef.current.click()}>
          <span>📎</span>
        </button>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onSend()}
          placeholder={placeholder}
          className="chat-input"
        />
        <button className="send-btn" onClick={onSend} disabled={!inputValue.trim()}>
          <span>→</span>
        </button>
      </div>
    </div>
  );
});

export default ChatPanel;
