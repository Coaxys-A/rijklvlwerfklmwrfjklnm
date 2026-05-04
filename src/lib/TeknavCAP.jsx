import { useState, useEffect } from 'react';

const TeknavCAP = ({ onChange, style = {} }) => {
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [userSolution, setUserSolution] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCaptcha = async () => {
    setLoading(true);
    setError('');
    setUserSolution('');
    try {
      const response = await fetch('/api/teknav-cap/generate', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load captcha');
      const data = await response.json();
      setCaptchaId(data.id);
      setCaptchaSvg(data.data);
      if (onChange) onChange({ captchaId: data.id, userSolution: '' });
    } catch (err) {
      setError('خطا در بارگذاری کپچا');
      console.error('TeknavCAP load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setUserSolution(value);
    if (onChange) onChange({ captchaId, userSolution: value });
  };

  return (
    <div style={{ direction: 'rtl', ...style }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        marginBottom: 8,
        flexWrap: 'wrap',
      }}>
        <div 
          onClick={loadCaptcha}
          style={{
            border: '2px solid #E4DDD2',
            borderRadius: 8,
            padding: 8,
            background: '#fff',
            cursor: 'pointer',
            minWidth: 200,
            minHeight: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'all 0.2s',
          }}
          title="برای تازه‌سازی کلیک کنید"
        >
          {loading ? (
            <div style={{ fontSize: 13, color: '#5F6B6D' }}>در حال بارگذاری...</div>
          ) : error ? (
            <div style={{ fontSize: 12, color: '#C94C4C' }}>{error}</div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: captchaSvg }} />
          )}
        </div>
        <button
          type="button"
          onClick={loadCaptcha}
          disabled={loading}
          style={{
            padding: '10px 16px',
            background: '#0F6B73',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontFamily: 'Vazirmatn, sans-serif',
            fontWeight: 600,
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          ↻ تازه‌سازی
        </button>
      </div>
      <input
        type="text"
        value={userSolution}
        onChange={handleInputChange}
        placeholder="کد امنیتی را وارد کنید"
        maxLength={10}
        autoComplete="off"
        dir="ltr"
        style={{
          width: '100%',
          padding: '10px 14px',
          border: '1px solid #E4DDD2',
          borderRadius: 8,
          fontSize: 14,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          textAlign: 'center',
          background: '#fff',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => e.target.style.borderColor = '#0F6B73'}
        onBlur={(e) => e.target.style.borderColor = '#E4DDD2'}
      />
    </div>
  );
};

export default TeknavCAP;
