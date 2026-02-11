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

        /* ===== 로그인/회원가입 ===== */
        .auth-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            text-align: center;
        }
        .auth-area h2 { margin-bottom: 8px; color: #333; }
        .auth-area p { color: #666; margin-bottom: 24px; font-size: 14px; }
        .auth-area input {
            width: 100%; max-width: 360px;
            padding: 12px 16px; margin: 6px 0;
            border: 2px solid #e0e0e0; border-radius: 8px; font-size: 15px;
        }
        .auth-area input:focus {
            border-color: #667eea;
            outline: none;
        }
        .auth-area button {
            width: 100%; max-width: 360px;
            padding: 12px; margin-top: 16px;
            background: #667eea; color: white; border: none;
            border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;
        }
        .auth-area button:hover { background: #5568d3; }
        .auth-toggle {
            margin-top: 16px;
            font-size: 14px;
            color: #666;
        }
        .auth-toggle a {
            color: #667eea;
            cursor: pointer;
            text-decoration: none;
        }
        .auth-toggle a:hover {
            text-decoration: underline;
        }

        /* ===== 채팅 영역 ===== */
        #chatArea { display: none; flex-direction: column; flex: 1; min-height: 0; }
        #chatArea.visible { display: flex; }
        #loginArea.hidden { display: none; }
        #signupArea { display: none; }
        #signupArea.visible { display: flex; }

        /* ===== 헤더 (고정) ===== */
        .chatbot-header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white; padding: 16px 20px; text-align: center;
            flex-shrink: 0; position: relative;
        }
        .chatbot-header h1 { font-size: 22px; margin-bottom: 4px; }
        .usage-info { font-size: 13px; opacity: 0.9; }

        /* 로그아웃 버튼 */
        .logout-btn {
            position: absolute; top: 14px; right: 16px;
            background: rgba(255,255,255,0.2); color: white;
            border: 1px solid rgba(255,255,255,0.4);
            padding: 4px 10px; border-radius: 12px;
            font-size: 12px; cursor: pointer;
        }
        .logout-btn:hover { background: rgba(255,255,255,0.35); }

        /* ===== 메시지 스크롤 영역 ===== */
        .chat-messages {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            padding: 16px 20px;
            background: #fafafa;
        }

        /* ===== 메시지 ===== */
        .message { margin-bottom: 12px; }
        .message.user { text-align: right; }
        .message.bot  { text-align: left; }

        .bubble {
            display: inline-block;
            max-width: 88%;
            padding: 12px 16px;
            border-radius: 16px;
            font-size: 15px;
            word-break: break-word;
            text-align: left;
        }
        .message.user .bubble { background: #667eea; color: white; }
        .message.bot  .bubble { background: white; border: 1px solid #e0e0e0; color: #333; }

        /* 봇 답변 내부 스타일 */
        .message.bot .bubble strong { color: #667eea; font-weight: 700; }
        .message.bot .bubble em { color: #555; font-style: italic; }
        .message.bot .bubble code {
            background: #f0f3ff; color: #667eea;
            padding: 1px 6px; border-radius: 3px; font-size: 14px;
            font-family: 'Consolas', monospace;
        }

        .message.bot .bubble .line {
            display: block;
            text-align: left;
            padding-left: 0;
            margin-left: 0;
            line-height: 1.7;
            margin-bottom: 1px;
        }
        .message.bot .bubble .gap { height: 8px; }
        .message.bot .bubble .divider { height: 1px; background: #eee; margin: 4px 0; }

        .msg-time { font-size: 11px; color: #999; margin-top: 3px; }
        .message.user .msg-time { text-align: right; }

        /* ===== 로딩 / 에러 ===== */
        .loading { display: none; padding: 8px; text-align: center; color: #667eea; flex-shrink: 0; }
        .loading.active { display: block; }
        .error-message { background: #fee; color: #c33; padding: 10px 16px; border-radius: 6px; margin: 6px 16px; display: none; flex-shrink: 0; }
        .error-message.active { display: block; }

        /* ===== 입력 영역 (고정) ===== */
        .chat-input-area { padding: 12px 16px; background: white; border-top: 1px solid #e0e0e0; flex-shrink: 0; }
        .input-wrapper { display: flex; gap: 8px; }
        #questionInput {
            flex: 1; padding: 10px 14px;
            border: 2px solid #e0e0e0; border-radius: 20px;
            font-size: 15px; outline: none;
        }
        #questionInput:focus { border-color: #667eea; }
        #sendButton {
            padding: 10px 22px; background: #667eea; color: white;
            border: none; border-radius: 20px; font-size: 15px;
            font-weight: 600; cursor: pointer;
        }
        #sendButton:hover { background: #5568d3; }
        #sendButton:disabled { background: #ccc; cursor: not-allowed; }

        /* ===== 퀴즈 버튼 ===== */
        .quiz-toggle-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #f093fb, #f5576c);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 10px;
        }
        .quiz-toggle-btn:hover {
            opacity: 0.9;
        }
        
        /* ===== 퀴즈 영역 ===== */
        .quiz-area {
            display: none;
            padding: 20px;
            background: white;
            border-radius: 12px;
            margin: 0 20px 16px 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .quiz-area.active {
            display: block;
        }
        .quiz-word {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            text-align: center;
            margin-bottom: 8px;
        }
        .quiz-pos {
            text-align: center;
            color: #999;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .quiz-choice {
            padding: 14px;
            margin: 8px 0;
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            cursor: pointer;
            font-size: 15px;
            transition: all 0.2s;
        }
        .quiz-choice:hover {
            background: #e9ecef;
            border-color: #667eea;
        }
        .quiz-choice.correct {
            background: #d4edda;
            border-color: #28a745;
            color: #155724;
        }
        .quiz-choice.wrong {
            background: #f8d7da;
            border-color: #dc3545;
            color: #721c24;
        }
        .quiz-choice.disabled {
            cursor: not-allowed;
        }
        .quiz-result {
            text-align: center;
            margin-top: 16px;
            padding: 12px;
            border-radius: 8px;
            font-weight: 600;
            display: none;
        }
        .quiz-result.show {
            display: block;
        }
        .quiz-result.correct {
            background: #d4edda;
            color: #155724;
        }
        .quiz-result.wrong {
            background: #f8d7da;
            color: #721c24;
        }
        .quiz-next-btn {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 12px;
            display: none;
        }
        .quiz-next-btn.show {
            display: block;
        }
        .quiz-close-btn {
            width: 100%;
            padding: 10px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            margin-top: 8px;
        }
    `;
    document.head.appendChild(style);

    // ========== HTML 삽입 ==========
    var html = `
        <button id="chatbot-toggle-btn" onclick="window.toggleChatbot()">
            <svg viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.38 0-2.68-.3-3.86-.84l-.28-.14-2.9.49.49-2.9-.14-.28C4.3 14.68 4 13.38 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
        </button>

        <div class="chatbot-container">
            <div id="loginArea" class="auth-area">
                <h2>🎓 AI 영어 튜터</h2>
                <p>로그인하여 시작하세요</p>
                <input type="email" id="loginEmail" placeholder="이메일" />
                <input type="password" id="loginPassword" placeholder="비밀번호" onkeypress="if(event.key==='Enter')window.chatbotLogin()" />
                <button onclick="window.chatbotLogin()">로그인</button>
                <div class="auth-toggle">
                    계정이 없으신가요? <a onclick="window.showSignupForm()">회원가입</a>
                </div>
            </div>

            <div id="signupArea" class="auth-area">
                <h2>🎓 회원가입</h2>
                <p>새 계정을 만드세요</p>
                <input type="text" id="signupName" placeholder="이름" />
                <input type="email" id="signupEmail" placeholder="이메일" />
                <input type="password" id="signupPassword" placeholder="비밀번호 (최소 6자)" />
                <input type="password" id="signupPasswordConfirm" placeholder="비밀번호 확인" onkeypress="if(event.key==='Enter')window.chatbotSignup()" />
                <button onclick="window.chatbotSignup()">가입하기</button>
                <div class="auth-toggle">
                    이미 계정이 있으신가요? <a onclick="window.showLoginForm()">로그인</a>
                </div>
            </div>

            <div id="chatArea">
                <div class="chatbot-header">
                    <h1>🎓 AI 영어 튜터</h1>
                    <div class="usage-info" id="usageInfo">남은 질문 횟수(간단한 질문: -, 복잡한 질문: -)</div>
                    <button class="logout-btn" onclick="window.chatbotLogout()">로그아웃</button>
                </div>
                <div class="error-message" id="errorMessage"></div>
                
                <div style="margin: 15px 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;">
                    <div style="margin-bottom: 12px; font-weight: bold; color: #495057;">
                        💡 질문 유형을 선택하세요
                    </div>
                    <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                        <button id="simpleBtn" onclick="window.selectQuestionType('simple')" 
                                style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                            간단한 질문
                        </button>
                        <button id="complexBtn" onclick="window.selectQuestionType('complex')" 
                                style="flex: 1; padding: 12px; background: #e9ecef; color: #6c757d; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                            복잡한 질문
                        </button>
                    </div>
                    <div style="font-size: 13px; color: #6c757d; line-height: 1.6;">
                        <div id="simpleDesc" style="display: block;">
                            ✓ 단어/문법 뜻 묻기<br>
                            ✓ 짧은 문장 해석<br>
                            ✓ 예: "flawlessly의 뜻은?"
                        </div>
                        <div id="complexDesc" style="display: none;">
                            ✓ 문제 풀이 전체 설명<br>
                            ✓ 긴 문단 분석 요청<br>
                            ✓ 예: "이 문제를 자세히 설명해주세요"
                        </div>
                    </div>
                </div>
                
                <div style="margin: 0 20px 10px 20px;">
                    <button class="quiz-toggle-btn" onclick="window.toggleQuiz()">
                        🎯 단어 퀴즈 풀기
                    </button>
                </div>
                
                <div class="quiz-area" id="quizArea">
                    <div class="quiz-word" id="quizWord">Loading...</div>
                    <div class="quiz-pos" id="quizPos"></div>
                    
                    <div id="quizChoices"></div>
                    
                    <div class="quiz-result" id="quizResult"></div>
                    <button class="quiz-next-btn" id="quizNextBtn" onclick="window.loadQuiz()">다음 문제</button>
                    <button class="quiz-close-btn" onclick="window.toggleQuiz()">퀴즈 닫기</button>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    <div class="message bot">
                        <div class="bubble">
                            <div class="line">안녕하세요! 👋</div>
                            <div class="line">수능 영어 질문을 자유롭게 해주세요.</div>
                            <div class="line">어휘, 문법, 독해 등 무엇이든 도와드리겠습니다!</div>
                        </div>
                        <div class="msg-time">...</div>
                    </div>
                </div>
                <div class="loading" id="loading">답변 생성 중...</div>
                <div class="chat-input-area">
                    <div class="input-wrapper">
                        <input type="text" id="questionInput" placeholder="질문을 입력하세요..." onkeypress="if(event.key==='Enter')window.sendQuestion()" />
                        <button id="sendButton" onclick="window.sendQuestion()">전송</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    var container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    // ========== 전역 변수 ==========
    window.API_URL = 'https://english-exam-chatbot.onrender.com';
    window.authToken = localStorage.getItem('authToken');
    window.selectedQuestionType = 'simple';

    // ========== 유틸리티 함수 ==========
    window.getPageContext = function() {
        var allText = document.body.innerText;
        var startIndex = allText.indexOf('정답:');
        if (startIndex === -1) {
            startIndex = allText.indexOf('[프리미엄 문제 분석]');
        }
        if (startIndex !== -1) {
            var context = allText.substring(startIndex);
            console.log('해설 추출 완료:', context.length, '글자');
            return context;
        }
        console.log('해설을 찾을 수 없습니다');
        return '';
    };

    window.getPageId = function() {
        return window.location.pathname || 'default-page';
    };

    // ========== 자동 로그인 ==========
    window.checkAutoLogin = async function() {
        var token = localStorage.getItem('authToken');
        if (!token) {
            return false;
        }

        try {
            var res = await fetch(window.API_URL + '/api/auth/verify', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });

            if (res.ok) {
                var data = await res.json();
                if (data.success) {
                    window.authToken = token;
                    window.showChatArea();
                    window.loadUsageInfo();
                    
                    if (window.pendingContext) {
                        window.cacheContext(window.pendingContext.page_id, window.pendingContext.context);
                    }
                    return true;
                }
            }
            
            localStorage.removeItem('authToken');
            return false;
        } catch(e) {
            console.error('자동 로그인 실패:', e);
            return false;
        }
    };

    // ========== 페이지 로드 시 실행 ==========
    window.addEventListener('load', async function() {
        var context = window.getPageContext();
        if (context) {
            var page_id = window.getPageId();
            console.log('페이지 로드 완료, 해설 캐싱 준비:', page_id);
            window.pendingContext = { page_id: page_id, context: context };
        }

        await window.checkAutoLogin();
    });

    // ========== 폼 전환 ==========
    window.showLoginForm = function() {
        document.getElementById('signupArea').classList.remove('visible');
        document.getElementById('loginArea').classList.remove('hidden');
    };

    window.showSignupForm = function() {
        document.getElementById('loginArea').classList.add('hidden');
        document.getElementById('signupArea').classList.add('visible');
    };

    // ========== 회원가입 ==========
    window.chatbotSignup = async function() {
        var name = document.getElementById('signupName').value.trim();
        var email = document.getElementById('signupEmail').value.trim();
        var password = document.getElementById('signupPassword').value;
        var passwordConfirm = document.getElementById('signupPasswordConfirm').value;

        if (!name || !email || !password) {
            return window.showError('모든 항목을 입력해주세요.');
        }

        if (password.length < 6) {
            return window.showError('비밀번호는 최소 6자 이상이어야 합니다.');
        }

        if (password !== passwordConfirm) {
            return window.showError('비밀번호가 일치하지 않습니다.');
        }

        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return window.showError('올바른 이메일 형식이 아닙니다.');
        }

        try {
            var res = await fetch(window.API_URL + '/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: name,
                    email: email, 
                    password: password 
                })
            });

            var data = await res.json();
            
            if (data.success && data.token) {
                window.authToken = data.token;
                localStorage.setItem('authToken', window.authToken);
                
                if (window.pendingContext) {
                    window.cacheContext(window.pendingContext.page_id, window.pendingContext.context);
                }
                
                window.showChatArea();
                window.loadUsageInfo();
                
                document.getElementById('signupName').value = '';
                document.getElementById('signupEmail').value = '';
                document.getElementById('signupPassword').value = '';
                document.getElementById('signupPasswordConfirm').value = '';
            } else {
                window.showError(data.message || '회원가입 실패');
            }
        } catch(e) {
            window.showError('서버 연결 실패');
        }
    };

    // ========== 로그인 ==========
    window.chatbotLogin = async function() {
        var email = document.getElementById('loginEmail').value.trim();
        var password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            return window.showError('이메일과 비밀번호를 모두 입력해주세요.');
        }

        try {
            var res = await fetch(window.API_URL + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: email, 
                    password: password 
                })
            });

            var data = await res.json();
            
            if (data.success && data.token) {
                window.authToken = data.token;
                localStorage.setItem('authToken', window.authToken);
                
                if (window.pendingContext) {
                    window.cacheContext(window.pendingContext.page_id, window.pendingContext.context);
                }
                
                window.showChatArea();
                window.loadUsageInfo();
                
                document.getElementById('loginEmail').value = '';
                document.getElementById('loginPassword').value = '';
            } else {
                window.showError(data.message || '로그인 실패');
            }
        } catch(e) {
            window.showError('서버 연결 실패');
        }
    };

    // ========== 로그아웃 ==========
    window.chatbotLogout = function() {
        localStorage.removeItem('authToken');
        window.authToken = null;
        document.getElementById('chatArea').classList.remove('visible');
        document.getElementById('loginArea').classList.remove('hidden');
        document.getElementById('signupArea').classList.remove('visible');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    };

    // ========== 토큰 만료 체크 ==========
    window.checkAuthError = function(res) {
        if (res.status === 401 || res.status === 403) {
            window.chatbotLogout();
            window.showError('세션이 만료되었습니다. 다시 로그인해주세요.');
            return true;
        }
        return false;
    };

    // ========== 채팅 영역 표시 ==========
    window.showChatArea = function() {
        document.getElementById('loginArea').classList.add('hidden');
        document.getElementById('signupArea').classList.remove('visible');
        document.getElementById('chatArea').classList.add('visible');
    };

    // ========== 캐싱 함수 ==========
    window.cacheContext = async function(page_id, context) {
        try {
            var res = await fetch(window.API_URL + '/api/cache-context', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + window.authToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ page_id: page_id, context: context })
            });
            var data = await res.json();
            if (data.success) {
                console.log('캐싱 완료:', data.cached_length, '글자');
            }
        } catch(e) {
            console.error('캐싱 오류:', e);
        }
    };

    // ========== 질문 유형 선택 ==========
    window.selectQuestionType = function(type) {
        window.selectedQuestionType = type;
        
        var simpleBtn = document.getElementById('simpleBtn');
        var complexBtn = document.getElementById('complexBtn');
        var simpleDesc = document.getElementById('simpleDesc');
        var complexDesc = document.getElementById('complexDesc');
        
        if (type === 'simple') {
            simpleBtn.style.background = '#28a745';
            simpleBtn.style.color = 'white';
            complexBtn.style.background = '#e9ecef';
            complexBtn.style.color = '#6c757d';
            simpleDesc.style.display = 'block';
            complexDesc.style.display = 'none';
        } else {
            simpleBtn.style.background = '#e9ecef';
            simpleBtn.style.color = '#6c757d';
            complexBtn.style.background = '#007bff';
            complexBtn.style.color = 'white';
            simpleDesc.style.display = 'none';
            complexDesc.style.display = 'block';
        }
    };

    // ========== 사용량 로드 ==========
    window.loadUsageInfo = async function() {
        try {
            var res = await fetch(window.API_URL + '/api/usage', {
                headers: { 'Authorization': 'Bearer ' + window.authToken }
            });
            if (window.checkAuthError(res)) return;
            var data = await res.json();
            if (data['성공']) {
                document.getElementById('usageInfo').textContent =
                    '남은 질문 횟수(간단한 질문: ' + data['이번달']['간단한질문']['남음'] +
                    ', 복잡한 질문: ' + data['이번달']['복잡한질문']['남음'] + ')';
            }
        } catch(e) { 
            console.error(e); 
        }
    };

    // ========== 질문 전송 ==========
    window.sendQuestion = async function() {
        var input = document.getElementById('questionInput');
        var question = input.value.trim();
        if (!question) return;

        window.addMessage(question, 'user');
        input.value = '';
        document.getElementById('sendButton').disabled = true;
        document.getElementById('loading').classList.add('active');

        try {
            var res = await fetch(window.API_URL + '/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': 'Bearer ' + window.authToken 
                },
                body: JSON.stringify({ 
                    question: question, 
                    questionType: window.selectedQuestionType,
                    page_id: window.getPageId()
                })
            });
            
            if (window.checkAuthError(res)) return;
            
            var data = await res.json();
            if (data.answer) {
                window.addMessage(data.answer, 'bot');
                window.loadUsageInfo();
            } else {
                window.showError(data.message || '답변을 받지 못했습니다.');
            }
        } catch(e) {
            window.showError('서버 연결 실패');
        } finally {
            document.getElementById('sendButton').disabled = false;
            document.getElementById('loading').classList.remove('active');
        }
    };

    // ========== Markdown → HTML 변환 ==========
    window.formatMessage = function(rawText) {
        var text = rawText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/#{1,6}\s+(.*)/g, '**$1**');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, '<em>$1</em>');
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

        var lines = text.split('\n');
        var html = '';

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();

            if (line === '') { 
                html += '<div class="gap"></div>'; 
                continue; 
            }
            
            if (/^[-_*]{3,}$/.test(line)) { 
                html += '<div class="divider"></div>'; 
                continue; 
            }

            var numM = line.match(/^(\d+)[.)]\s+([\s\S]*)/);
            if (numM) {
                html += '<div class="line">📌 <strong>' + numM[1] + '.</strong> ' + numM[2] + '</div>';
                continue;
            }

            var bulM = line.match(/^[-•]\s+([\s\S]*)/);
            if (bulM) {
                html += '<div class="line">• ' + bulM[1] + '</div>';
                continue;
            }

            var titM = line.match(/^(<strong>[^<]+<\/strong>)\s*:?\s*$/);
            if (titM) {
                var ni = i + 1;
                while (ni < lines.length && lines[ni].trim() === '') ni++;

                if (ni < lines.length) {
                    var nextLine = lines[ni].trim();
                    var nextIsList = /^[-•]\s/.test(nextLine) || /^\d+[.)]\s/.test(nextLine);
                    var nextIsTitle = /^<strong>/.test(nextLine);

                    if (!nextIsList && !nextIsTitle && !/^[-_*]{3,}$/.test(nextLine)) {
                        html += '<div class="line">' + titM[1] + ': ' + nextLine + '</div>';
                        i = ni;
                        continue;
                    }
                }
                html += '<div class="gap"></div>';
                html += '<div class="line">' + titM[1] + '</div>';
                continue;
            }

            html += '<div class="line">' + line + '</div>';
        }

        return html;
    };

    // ========== 메시지 추가 ==========
    window.addMessage = function(text, sender) {
        var container = document.getElementById('chatMessages');

        var msgDiv = document.createElement('div');
        msgDiv.className = 'message ' + sender;

        var bubble = document.createElement('div');
        bubble.className = 'bubble';

        if (sender === 'bot') {
            bubble.innerHTML = window.formatMessage(text);
        } else {
            bubble.textContent = text;
        }

        var timeDiv = document.createElement('div');
        timeDiv.className = 'msg-time';
        timeDiv.textContent = new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        msgDiv.appendChild(bubble);
        msgDiv.appendChild(timeDiv);
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    };

    // ========== 에러 표시 ==========
    window.showError = function(msg) {
        var el = document.getElementById('errorMessage');
        el.textContent = msg;
        el.classList.add('active');
        setTimeout(function() { 
            el.classList.remove('active'); 
        }, 5000);
    };

    // ========== 챗봇 토글 ==========
    window.toggleChatbot = function() {
        var container = document.querySelector('.chatbot-container');
        container.classList.toggle('open');
    };

    // ========== 퀴즈 토글 ==========
    window.toggleQuiz = function() {
        var quizArea = document.getElementById('quizArea');
        var isActive = quizArea.classList.contains('active');
        
        if (isActive) {
            quizArea.classList.remove('active');
        } else {
            quizArea.classList.add('active');
            window.loadQuiz();
        }
    };

    // ========== 퀴즈 로드 ==========
    window.loadQuiz = async function() {
        if (!window.authToken) {
            window.showError('로그인이 필요합니다');
            return;
        }
        
        try {
            document.getElementById('quizResult').className = 'quiz-result';
            document.getElementById('quizNextBtn').className = 'quiz-next-btn';
            
            var res = await fetch(window.API_URL + '/api/quiz/random', {
                headers: { 'Authorization': 'Bearer ' + window.authToken }
            });
            
            if (window.checkAuthError(res)) return;
            
            var data = await res.json();
            
            if (data.success && data.quiz) {
                window.displayQuiz(data.quiz);
            } else {
                window.showError(data.message || '퀴즈를 불러올 수 없습니다');
            }
        } catch(e) {
            console.error('퀴즈 로드 오류:', e);
            window.showError('퀴즈 로드 실패');
        }
    };

    // ========== 퀴즈 표시 ==========
    window.displayQuiz = function(quiz) {
        document.getElementById('quizWord').textContent = quiz.word;
        document.getElementById('quizPos').textContent = quiz.part_of_speech ? 
            '(' + quiz.part_of_speech + ')' : '';
        
        var choicesContainer = document.getElementById('quizChoices');
        choicesContainer.innerHTML = '';
        
        quiz.choices.forEach(function(choice, index) {
            var choiceDiv = document.createElement('div');
            choiceDiv.className = 'quiz-choice';
            choiceDiv.textContent = (index + 1) + '. ' + choice;
            choiceDiv.onclick = function() {
                window.selectAnswer(index, quiz.correct_index, quiz.choices);
            };
            choicesContainer.appendChild(choiceDiv);
        });
        
        window.currentQuizAnswer = quiz.correct_index;
    };

    // ========== 퀴즈 답변 선택 ==========
    window.selectAnswer = function(selectedIndex, correctIndex, choices) {
        var allChoices = document.querySelectorAll('.quiz-choice');
        allChoices.forEach(function(choice) {
            choice.classList.add('disabled');
            choice.onclick = null;
        });
        
        var isCorrect = selectedIndex === correctIndex;
        
        allChoices[selectedIndex].classList.add(isCorrect ? 'correct' : 'wrong');
        allChoices[correctIndex].classList.add('correct');
        
        var resultDiv = document.getElementById('quizResult');
        resultDiv.className = 'quiz-result show ' + (isCorrect ? 'correct' : 'wrong');
        resultDiv.textContent = isCorrect ? 
            '🎉 정답입니다!' : 
            '❌ 틀렸습니다! 정답: ' + choices[correctIndex];
        
        document.getElementById('quizNextBtn').classList.add('show');
    };

})();
