import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import html2pdf from 'html2pdf.js'
import './App.css'

function App() {
  const [exams, setExams] = useState([{ name: '', date: '', subjects: '' }])
  const [subjects, setSubjects] = useState([{ name: '' }])
  const [difficulties, setDifficulties] = useState([{ course: '', difficulty: 'Medium' }])
  const [hoursPerDay, setHoursPerDay] = useState(3)
  
  const [plan, setPlan] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Quiz State
  const [isQuizMode, setIsQuizMode] = useState(false)
  const [quizData, setQuizData] = useState(null)
  const [isQuizLoading, setIsQuizLoading] = useState(false)
  const [userAnswers, setUserAnswers] = useState({})
  const [quizResult, setQuizResult] = useState(null)
  const [subjectEvaluations, setSubjectEvaluations] = useState({})

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([
    { sender: 'ai', text: "Hi! I'm your AI Study Coach. Need any study tips, motivation, or concept explanations? Just ask!" }
  ])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatBodyRef = useRef(null)

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
    }
  }, [chatHistory])

  const updateArray = (setter, array, index, field, value) => {
    const newArray = [...array]
    newArray[index][field] = value
    setter(newArray)
  }

  const addRow = (setter, array, emptyObject) => {
    setter([...array, emptyObject])
  }

  const removeRow = (setter, array, index) => {
    if (array.length === 1) return;
    const newArray = [...array]
    newArray.splice(index, 1)
    setter(newArray)
  }

  // Generate Plan endpoint
  const handleGeneratePlan = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    
    try {
      const response = await axios.post(`${API_URL}/api/generate-plan`, {
        exams: exams.filter(e => e.name !== ''),
        subjects: subjects.map(s => s.name).filter(n => n !== ''),
        subject_evaluations: subjectEvaluations,
        course_difficulties: difficulties.filter(d => d.course !== ''),
        hours_per_day: parseFloat(hoursPerDay)
      })
      
      setPlan(response.data.plan)
    } catch (error) {
      console.error("Error connecting to backend:", error)
      setPlan("⚠️ Error connecting to server. Please ensure the backend is running and accessible.")
    } finally {
      setIsLoading(false)
    }
  }

  // Download PDF
  const handleDownload = () => {
    if (!plan) return;
    const element = document.getElementById('plan-content');
    const opt = {
      margin:       0.5,
      filename:     'Nova_Study_Plan.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  }

  // Chatbot logic
  const handleChatSubmit = async (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMsg = chatInput.trim()
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }])
    setChatInput('')
    setIsChatLoading(true)

    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    try {
      const response = await axios.post(`${API_URL}/api/chat`, { message: userMsg })
      setChatHistory(prev => [...prev, { sender: 'ai', text: response.data.reply }])
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory(prev => [...prev, { sender: 'ai', text: "⚠️ Sorry, I'm having trouble connecting to the server right now." }])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Generate Trivia Quiz logic
  const handleTestKnowledge = async () => {
    const validSubjects = subjects.map(s => s.name).filter(n => n !== '');
    if (validSubjects.length === 0) {
      alert("Please enter at least one subject to generate a quiz.");
      return;
    }

    setIsQuizLoading(true);
    setIsQuizMode(true);
    setQuizData(null);
    setQuizResult(null);
    setUserAnswers({});
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    try {
      const response = await axios.post(`${API_URL}/api/generate-quiz`, { subjects: validSubjects })
      
      // Parse the JSON string from Gemini
      let parsedQuiz = response.data.quiz_data;
      if (typeof parsedQuiz === 'string') {
          // Sometimes Gemini wraps JSON in markdown blocks despite mime-type
          if (parsedQuiz.startsWith("```json")) {
              parsedQuiz = parsedQuiz.replace(/```json\n/, '').replace(/\n```/, '');
          }
          parsedQuiz = JSON.parse(parsedQuiz);
      }
      setQuizData(parsedQuiz);
    } catch (error) {
      console.error("Quiz generation error:", error);
      alert("Failed to generate quiz. Please try again.");
      setIsQuizMode(false);
    } finally {
      setIsQuizLoading(false);
    }
  }

  const handleAnswerChange = (qIndex, answer) => {
    setUserAnswers(prev => ({
      ...prev,
      [qIndex]: answer
    }));
  }

  // Grade Quiz logic
  const handleSubmitQuiz = () => {
    let score = 0;
    const subjectScores = {}; 
    
    quizData.forEach((q, idx) => {
      const userAns = (userAnswers[idx] || '').toString().trim().toLowerCase();
      const realAns = q.answer.toString().trim().toLowerCase();
      const isCorrect = userAns === realAns;
      
      if (!subjectScores[q.subject]) {
        subjectScores[q.subject] = { total: 0, correct: 0 };
      }
      subjectScores[q.subject].total += 1;
      
      if (isCorrect) {
        score += 1;
        subjectScores[q.subject].correct += 1;
      }
    });

    const evaluations = {};
    Object.keys(subjectScores).forEach(sub => {
      const ratio = subjectScores[sub].correct / subjectScores[sub].total;
      if (ratio >= 0.8) evaluations[sub] = "Strong - Needs minimal review";
      else if (ratio >= 0.5) evaluations[sub] = "Average - Needs standard practice";
      else evaluations[sub] = "Poor - NEEDS HEAVY FOCUS AND REVISION";
    });

    setSubjectEvaluations(evaluations);
    setQuizResult({ score, total: quizData.length });
  }

  const closeQuiz = () => {
    setIsQuizMode(false);
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Nova Planner <span>✧</span></h1>
        <p>Your AI-orchestrated path to academic mastery</p>
      </header>
      
      <form onSubmit={handleGeneratePlan} className="planner-form">
        
        {/* EXAMS SECTION */}
        <div className="form-section">
          <div className="section-header">
            <h3><span className="icon">📅</span> Upcoming Exams</h3>
          </div>
          {exams.map((exam, i) => (
            <div key={i} className="row-group">
              <input type="text" placeholder="Exam Name (e.g. Midterm)" value={exam.name} onChange={(e) => updateArray(setExams, exams, i, 'name', e.target.value)} required />
              <input type="date" value={exam.date} onChange={(e) => updateArray(setExams, exams, i, 'date', e.target.value)} required />
              <input type="text" placeholder="Subjects Covered" value={exam.subjects} onChange={(e) => updateArray(setExams, exams, i, 'subjects', e.target.value)} required />
              {exams.length > 1 && (
                <button type="button" className="btn-remove" onClick={() => removeRow(setExams, exams, i)} title="Remove Exam">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn-add" onClick={() => addRow(setExams, exams, { name: '', date: '', subjects: '' })}>
            <span>+</span> Add Another Exam
          </button>
        </div>

        {/* SUBJECTS SECTION (NEW) */}
        <div className="form-section">
          <div className="section-header">
            <h3><span className="icon">🧠</span> Academic Subjects</h3>
          </div>
          {subjects.map((item, i) => (
            <div key={i} className="row-group">
              <input type="text" placeholder="Subject (e.g. Mathematics)" value={item.name} onChange={(e) => updateArray(setSubjects, subjects, i, 'name', e.target.value)} required />
              {subjects.length > 1 && (
                <button type="button" className="btn-remove" onClick={() => removeRow(setSubjects, subjects, i)} title="Remove Subject">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-add" onClick={() => addRow(setSubjects, subjects, { name: '' })}>
              <span>+</span> Add Another Subject
            </button>
            <button type="button" className="btn-quiz" onClick={handleTestKnowledge}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              {Object.keys(subjectEvaluations).length > 0 ? "Retake Knowledge Quiz" : "Test My Knowledge (AI Trivia)"}
            </button>
          </div>
          
          {/* Display current evaluations if quiz was taken */}
          {Object.keys(subjectEvaluations).length > 0 && (
             <div className="evaluations-badge-container">
               {Object.entries(subjectEvaluations).map(([sub, status], idx) => (
                  <div key={idx} className={`eval-badge ${status.includes('Strong') ? 'eval-strong' : status.includes('Poor') ? 'eval-poor' : 'eval-avg'}`}>
                     {sub}: {status.split(' -')[0]}
                  </div>
               ))}
             </div>
          )}
        </div>

        {/* COURSE DIFFICULTY SECTION */}
        <div className="form-section">
          <div className="section-header">
            <h3><span className="icon">📚</span> Course Difficulties</h3>
          </div>
          {difficulties.map((item, i) => (
            <div key={i} className="row-group">
              <input type="text" placeholder="Course (e.g. CS101)" value={item.course} onChange={(e) => updateArray(setDifficulties, difficulties, i, 'course', e.target.value)} required />
              <select value={item.difficulty} onChange={(e) => updateArray(setDifficulties, difficulties, i, 'difficulty', e.target.value)}>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
              {difficulties.length > 1 && (
                <button type="button" className="btn-remove" onClick={() => removeRow(setDifficulties, difficulties, i)} title="Remove Course">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn-add" onClick={() => addRow(setDifficulties, difficulties, { course: '', difficulty: 'Medium' })}>
            <span>+</span> Add Another Course
          </button>
        </div>

        {/* TIME SECTION */}
        <div className="form-section">
          <div className="section-header">
            <h3><span className="icon">⏳</span> Time Commitment</h3>
          </div>
          <div className="hours-input-wrapper">
            <span style={{color: '#94a3b8'}}>Hours available to study daily: </span>
            <input type="number" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} min="0.5" step="0.5" required />
          </div>
        </div>

        <button type="submit" className="btn-generate" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner"></span>
              Architecting Plan...
            </>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
              Generate Mastery Plan
            </>
          )}
        </button>
      </form>

      {/* RESULT SECTION */}
      {plan && (
        <div className="results-container" id="results">
          <div className="results-header">
            <div className="results-header-left">
              <div style={{fontSize: '2rem'}}>✨</div>
              <h2>Your Custom Pathway</h2>
              <div className="badge">AI Generated</div>
            </div>
            
            <button className="btn-download" onClick={handleDownload} title="Download as PDF">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download PDF
            </button>
          </div>
          
          <div className="markdown-body" id="plan-content">
            <ReactMarkdown>{plan}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* CHATBOT WIDGET */}
      <div className={`chat-widget ${isChatOpen ? 'open' : ''}`}>
        {!isChatOpen ? (
          <button className="chat-toggle-btn" onClick={() => setIsChatOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Study Coach
          </button>
        ) : (
          <div className="chat-window">
            <div className="chat-header">
              <div className="chat-title">
                <span className="dot"></span> AI Study Coach
              </div>
              <button className="chat-close" onClick={() => setIsChatOpen(false)}>×</button>
            </div>
            <div className="chat-body" ref={chatBodyRef}>
              {chatHistory.map((msg, i) => (
                <div key={i} className={`chat-bubble-container ${msg.sender}`}>
                  <div className="chat-bubble">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="chat-bubble-container ai returning">
                  <div className="chat-bubble typing">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </div>
              )}
            </div>
            <form className="chat-input-area" onSubmit={handleChatSubmit}>
              <input 
                type="text" 
                placeholder="Ask for tips or motivation..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatLoading}
              />
              <button type="submit" disabled={isChatLoading || !chatInput.trim()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* QUIZ OVERLAY */}
      {isQuizMode && (
        <div className="quiz-overlay">
          <div className="quiz-modal">
            <div className="quiz-header">
              <h2>Diagnostic Trivia</h2>
              <button className="btn-close-quiz" onClick={closeQuiz}>×</button>
            </div>
            
            <div className="quiz-content">
              {isQuizLoading ? (
                <div className="quiz-loader">
                   <div className="spinner"></div>
                   <p>Generating adaptive questions across your subjects...</p>
                </div>
              ) : quizData ? (
                <div className="quiz-questions">
                   {quizResult && (
                     <div className="quiz-score-banner">
                        <h3>You scored {quizResult.score} / {quizResult.total}!</h3>
                        <p>Your study plan&apos;s priorities have been automatically adjusted based on this evaluation.</p>
                     </div>
                   )}
                   
                   {quizData.map((q, idx) => {
                     const isSubmitted = quizResult !== null;
                     const userAns = (userAnswers[idx] || '').toString().trim().toLowerCase();
                     const realAns = q.answer.toString().trim().toLowerCase();
                     const isCorrect = userAns === realAns;
                     
                     let cardClass = "quiz-card";
                     if (isSubmitted) {
                       cardClass += isCorrect ? " correct-card" : " incorrect-card";
                     }

                     return (
                       <div key={idx} className={cardClass}>
                         <div className="quiz-subject-tag">{q.subject}</div>
                         <h4>{idx + 1}. {q.question}</h4>
                         
                         {q.type === 'mcq' ? (
                           <div className="quiz-options">
                             {q.options.map((opt, oIdx) => (
                                <label key={oIdx} className="quiz-option-label">
                                  <input 
                                    type="radio" 
                                    name={`question-${idx}`} 
                                    value={opt}
                                    checked={userAnswers[idx] === opt}
                                    onChange={() => handleAnswerChange(idx, opt)}
                                    disabled={isSubmitted}
                                  />
                                  <span>{opt}</span>
                                </label>
                             ))}
                           </div>
                         ) : (
                           <div className="quiz-input">
                              <input 
                                type="text" 
                                placeholder="Type your answer..."
                                value={userAnswers[idx] || ''}
                                onChange={(e) => handleAnswerChange(idx, e.target.value)}
                                disabled={isSubmitted}
                              />
                           </div>
                         )}

                         {isSubmitted && !isCorrect && (
                           <div className="quiz-correction">
                              Correct answer: <strong>{q.answer}</strong>
                           </div>
                         )}
                       </div>
                     )
                   })}

                   {!quizResult && (
                     <button className="btn-submit-quiz" onClick={handleSubmitQuiz}>
                       Submit Answers & Analyze
                     </button>
                   )}
                </div>
              ) : (
                 <p>Failed to load quiz.</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App