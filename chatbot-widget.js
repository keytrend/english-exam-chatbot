(function() {
    'use strict';

    // ========== CSS 삽입 ==========
    var style = document.createElement('style');
    style.textContent = `
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* 떠다니는 챗봇 버튼 */
        #chatbot-toggle-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 50%;
            border: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            transition: transform 0.3s;
        }

        #chatbot-toggle-btn:hover {
            transform: scale(1.1);
        }

        #chatbot-toggle-btn svg {
            width: 30px;
            height: 30px;
            fill: white;
        }

        .chatbot-container {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 400px;
            height: 600px;
            background: white;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            border-radius: 16px;
            display: none;
            flex-direction: column;
            overflow: hidden;
            z-index: 9999;
        }

        .chatbot-container.open {
            display: flex;
        }

        @media (max-width: 480px) {
            .chatbot-container {
                width: calc(100vw - 40px);
                height: calc(100vh - 120px);
                right: 20px;
                bottom: 90px;
            }
        }
