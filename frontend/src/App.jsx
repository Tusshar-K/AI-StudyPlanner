import { useState } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import './App.css'

function App() {
  const [exams, setExams] = useState([{ name: '', date: '', subjects: '' }])
  const [strengths, setStrengths] = useState([{ subject: '', strength: 'Weak' }])
  const [difficulties, setDifficulties] = useState([{ course: '', difficulty: 'Medium' }])
  const [hoursPerDay, setHoursPerDay] = useState(3)
  
  const [plan, setPlan] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const updateArray = (setter, array, index, field, value) => {
    const newArray = [...array]
    newArray[index][field] = value
    setter(newArray)
  }

  const addRow = (setter, array, emptyObject) => {
    setter([...array, emptyObject])
  }

  const removeRow = (setter, array, index) => {
    if (array.length === 1) return; // Keep at least one row
    const newArray = [...array]
    newArray.splice(index, 1)
    setter(newArray)
  }

  const handleGeneratePlan = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Fallback to localhost if env var is missing during local dev
    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    
    try {
      const response = await axios.post(`${API_URL}/api/generate-plan`, {
        exams: exams.filter(e => e.name !== ''),
        subject_strengths: strengths.filter(s => s.subject !== ''),
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

        {/* STRENGTHS SECTION */}
        <div className="form-section">
          <div className="section-header">
            <h3><span className="icon">💪</span> Subject Strengths</h3>
          </div>
          {strengths.map((item, i) => (
            <div key={i} className="row-group">
              <input type="text" placeholder="Subject (e.g. Mathematics)" value={item.subject} onChange={(e) => updateArray(setStrengths, strengths, i, 'subject', e.target.value)} required />
              <select value={item.strength} onChange={(e) => updateArray(setStrengths, strengths, i, 'strength', e.target.value)}>
                <option value="Weak">Weak (Needs Focus)</option>
                <option value="Strong">Strong (Just Revise)</option>
              </select>
              {strengths.length > 1 && (
                <button type="button" className="btn-remove" onClick={() => removeRow(setStrengths, strengths, i)} title="Remove Subject">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn-add" onClick={() => addRow(setStrengths, strengths, { subject: '', strength: 'Weak' })}>
            <span>+</span> Add Another Subject
          </button>
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
            <div style={{fontSize: '2rem'}}>✨</div>
            <h2>Your Custom Pathway</h2>
            <div className="badge">AI Generated</div>
          </div>
          
          <div className="markdown-body">
            <ReactMarkdown>{plan}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

export default App