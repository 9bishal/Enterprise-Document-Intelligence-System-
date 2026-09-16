import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon, SearchIcon, UploadIcon, CpuIcon, LockIcon, FlashIcon, BarChartIcon } from './Icons';

const FEATURES = [
  {
    icon: SearchIcon,
    title: 'Intelligent Document Query',
    desc: 'Ask natural language questions about your uploaded documents. The AI retrieves the most relevant information using semantic search and delivers precise, sourced answers.',
  },
  {
    icon: UploadIcon,
    title: 'Multi-Format Document Support',
    desc: 'Upload PDF, DOCX, TXT, and Markdown files. Documents are automatically parsed, chunked, and indexed into a vector database for instant retrieval.',
  },
  {
    icon: CpuIcon,
    title: 'Advanced RAG Pipeline',
    desc: 'Every query runs through a multi-stage pipeline: retrieval, relevance grading, LLM generation, and groundedness verification for reliable, trustworthy answers.',
  },
  {
    icon: LockIcon,
    title: 'Role-Based Access Control',
    desc: 'Admins manage users, departments, and document access. Viewers, Editors, and Admins each have appropriate permissions for a secure enterprise workspace.',
  },
  {
    icon: FlashIcon,
    title: 'Multi-Provider LLM Support',
    desc: 'Choose from Groq, Gemini, OpenAI, or Ollama. Configure models, temperature, and retrieval parameters. Admins can enforce global settings across the organization.',
  },
  {
    icon: BarChartIcon,
    title: 'Smart Caching & Cost Optimization',
    desc: 'Semantic caching reuses responses for similar queries, reducing LLM calls and costs. Admin analytics provide visibility into usage, tokens, and estimated spending.',
  },
];

const STEPS = [
  { num: '01', title: 'Upload Documents', desc: 'Upload your PDFs, DOCX, or text files. The system automatically indexes them into a searchable knowledge base.' },
  { num: '02', title: 'Configure Your LLM', desc: 'Connect your preferred AI provider (Groq, Gemini, OpenAI). Adjust model parameters to suit your needs.' },
  { num: '03', title: 'Ask Questions', desc: 'Type natural language queries. The AI retrieves relevant document sections and generates sourced answers.' },
  { num: '04', title: 'Review & Iterate', desc: 'Inspect sources, verify groundedness, and refine your questions. The system learns and caches for faster responses.' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    return () => {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
    };
  }, []);

  return (
    <div className="landing-page">
      {/* Nav */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <SparklesIcon style={{ width: 22, height: 22, color: '#030712' }} />
            <span className="landing-logo-text">Intradoc AI</span>
          </div>
          <div className="landing-nav-links">
            <button className="landing-nav-btn" onClick={() => navigate('/login')}>Sign In</button>
            <button className="landing-nav-btn primary" onClick={() => navigate('/login')}>Get Started</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <div className="landing-hero-badge">Enterprise Document Intelligence Platform</div>
          <h1 className="landing-hero-title">
            Turn your documents into<br />
            <span className="landing-hero-highlight">conversational knowledge</span>
          </h1>
          <p className="landing-hero-subtitle">
            Intradoc AI is a secure, RAG-powered document intelligence platform that lets you ask
            natural language questions about your corporate documents. Upload files, configure your AI,
            and get instant, sourced answers with full transparency into the reasoning pipeline.
          </p>
          <div className="landing-hero-cta">
            <button className="landing-cta-btn primary" onClick={() => navigate('/login')}>
              Get Started Free
            </button>
            <button className="landing-cta-btn secondary" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">Everything you need to query your documents</h2>
          <p className="landing-section-subtitle">
            A complete document intelligence platform built for the enterprise.
          </p>
          <div className="landing-features-grid">
            {FEATURES.map((f, i) => (
              <div key={i} className="landing-feature-card">
                <div className="landing-feature-icon">{React.createElement(f.icon, { style: { width: 24, height: 24 } })}</div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">How it works</h2>
          <p className="landing-section-subtitle">Get started in minutes.</p>
          <div className="landing-steps">
            {STEPS.map((s, i) => (
              <div key={i} className="landing-step">
                <div className="landing-step-number">{s.num}</div>
                <div className="landing-step-content">
                  <h3 className="landing-step-title">{s.title}</h3>
                  <p className="landing-step-desc">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && <div className="landing-step-line" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-section landing-section-cta">
        <div className="landing-section-inner">
          <h2 className="landing-section-title" style={{ color: '#fff' }}>Ready to get started?</h2>
          <p className="landing-section-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Deploy Intradoc AI in your organization and unlock the knowledge in your documents.
          </p>
          <button className="landing-cta-btn primary large" onClick={() => navigate('/login')}
            style={{ marginTop: 32 }}>
            Launch the App
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <p className="landing-footer-text">Intradoc AI — Document Intelligence Platform</p>
        </div>
      </footer>

      <style>{`
        .landing-page {
          min-height: 100vh;
          background: #FAF9F5;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #141413;
          overflow-x: hidden;
        }

        .landing-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(250, 249, 245, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(20, 20, 19, 0.06);
        }

        .landing-nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .landing-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .landing-logo-text {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: #030712;
        }

        .landing-nav-links {
          display: flex;
          gap: 12px;
        }

        .landing-nav-btn {
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
          background: transparent;
          color: #141413;
        }

        .landing-nav-btn:hover {
          background: rgba(20, 20, 19, 0.06);
        }

        .landing-nav-btn.primary {
          background: #030712;
          color: #fff;
          border-color: #030712;
        }

        .landing-nav-btn.primary:hover {
          background: #1a1c20;
          border-color: #1a1c20;
        }

        .landing-hero {
          position: relative;
          overflow: hidden;
        }

        .landing-hero-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(3, 7, 18, 0.03) 0%, transparent 70%),
                      radial-gradient(ellipse 60% 50% at 80% 100%, rgba(3, 7, 18, 0.02) 0%, transparent 60%);
          pointer-events: none;
        }

        .landing-hero-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 100px 24px 80px;
          text-align: center;
          position: relative;
        }

        .landing-hero-badge {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 100px;
          background: rgba(3, 7, 18, 0.06);
          font-size: 13px;
          font-weight: 600;
          color: #8E8B82;
          margin-bottom: 24px;
          letter-spacing: 0.3px;
        }

        .landing-hero-title {
          font-size: 48px;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -1.5px;
          color: #030712;
          margin: 0 0 24px;
        }

        .landing-hero-highlight {
          background: linear-gradient(135deg, #030712 0%, #5046e4 50%, #030712 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .landing-hero-subtitle {
          font-size: 17px;
          line-height: 1.7;
          color: #8E8B82;
          max-width: 640px;
          margin: 0 auto 40px;
        }

        .landing-hero-cta {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .landing-cta-btn {
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          border: 1px solid transparent;
        }

        .landing-cta-btn.primary {
          background: #030712;
          color: #fff;
          border-color: #030712;
        }

        .landing-cta-btn.primary:hover {
          background: #1a1c20;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(3, 7, 18, 0.15);
        }

        .landing-cta-btn.secondary {
          background: transparent;
          color: #141413;
          border-color: rgba(20, 20, 19, 0.15);
        }

        .landing-cta-btn.secondary:hover {
          background: rgba(20, 20, 19, 0.06);
          border-color: rgba(20, 20, 19, 0.25);
        }

        .landing-cta-btn.large {
          padding: 16px 36px;
          font-size: 16px;
        }

        .landing-section {
          padding: 80px 24px;
        }

        .landing-section-alt {
          background: rgba(20, 20, 19, 0.02);
          border-top: 1px solid rgba(20, 20, 19, 0.06);
          border-bottom: 1px solid rgba(20, 20, 19, 0.06);
        }

        .landing-section-cta {
          background: linear-gradient(135deg, #030712 0%, #1a1c20 100%);
          text-align: center;
        }

        .landing-section-inner {
          max-width: 1100px;
          margin: 0 auto;
        }

        .landing-section-title {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -1px;
          color: #030712;
          margin: 0 0 12px;
          text-align: center;
        }

        .landing-section-subtitle {
          font-size: 16px;
          color: #8E8B82;
          text-align: center;
          margin: 0 0 48px;
        }

        .landing-features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
        }

        .landing-feature-card {
          background: #fff;
          border: 1px solid rgba(20, 20, 19, 0.08);
          border-radius: 16px;
          padding: 28px;
          transition: all 0.25s ease;
        }

        .landing-feature-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(3, 7, 18, 0.08);
          border-color: rgba(20, 20, 19, 0.15);
        }

        .landing-feature-icon {
          font-size: 32px;
          margin-bottom: 16px;
        }

        .landing-feature-title {
          font-size: 16px;
          font-weight: 700;
          color: #030712;
          margin: 0 0 8px;
        }

        .landing-feature-desc {
          font-size: 14px;
          line-height: 1.6;
          color: #8E8B82;
          margin: 0;
        }

        .landing-steps {
          max-width: 640px;
          margin: 0 auto;
        }

        .landing-step {
          display: flex;
          gap: 20px;
          position: relative;
          padding-bottom: 32px;
        }

        .landing-step:last-child {
          padding-bottom: 0;
        }

        .landing-step-number {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #030712;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .landing-step-content {
          padding-top: 6px;
        }

        .landing-step-title {
          font-size: 18px;
          font-weight: 700;
          color: #030712;
          margin: 0 0 6px;
        }

        .landing-step-desc {
          font-size: 14px;
          line-height: 1.6;
          color: #8E8B82;
          margin: 0;
        }

        .landing-step-line {
          position: absolute;
          left: 24px;
          top: 48px;
          bottom: 0;
          width: 1px;
          background: rgba(20, 20, 19, 0.12);
        }

        .landing-footer {
          border-top: 1px solid rgba(20, 20, 19, 0.06);
          padding: 24px;
        }

        .landing-footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: center;
        }

        .landing-footer-text {
          font-size: 13px;
          color: #A39F94;
          margin: 0;
        }

        @media (max-width: 768px) {
          .landing-hero-title {
            font-size: 32px;
          }
          .landing-hero-content {
            padding: 60px 24px 50px;
          }
          .landing-section {
            padding: 50px 20px;
          }
          .landing-section-title {
            font-size: 26px;
          }
          .landing-features-grid {
            grid-template-columns: 1fr;
          }
          .landing-nav-btn.primary {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
