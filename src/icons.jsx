function Icon({ name }) {
  const style = { width: 18, height: 18, display: "inline-block", verticalAlign: "-3px" };
  if (name === "spark") {
    return (
      <svg style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (name === "list") {
    return (
      <svg style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    );
  }
  if (name === "track") {
    return (
      <svg style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M3.5 7l1.2 1.2L7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3.5 13l1.2 1.2L7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3.5 19l1.2 1.2L7 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (name === "plan") {
    return (
      <svg style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M8 7h8M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    );
  }
  return null;
}
