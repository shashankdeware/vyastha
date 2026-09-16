// import { useEffect, useState } from "react";
// import { createPortal } from "react-dom";
// import "./WelcomeNamaste.css";

// const DEFAULT_GREETING = "नमस्ते";

// export default function WelcomeNamaste({ userName = "", onComplete }) {
//   const [show, setShow] = useState(true);
//   const [editing, setEditing] = useState(false);
//   const [greeting, setGreeting] = useState(DEFAULT_GREETING);
//   const [tempGreeting, setTempGreeting] = useState(DEFAULT_GREETING);

//   useEffect(() => {
//     const saved = localStorage.getItem("vyastha_greeting") || DEFAULT_GREETING;
//     setGreeting(saved);
//     setTempGreeting(saved);
//   }, []);

//   useEffect(() => {
//     if (!show || editing) return;
//     const timer = setTimeout(closeAnimation, 5800);
//     return () => clearTimeout(timer);
//   }, [show, editing]);

//   const closeAnimation = () => {
//     setShow(false);
//     onComplete?.();
//   };

//   const saveGreeting = () => {
//     const value = tempGreeting.trim() || DEFAULT_GREETING;
//     localStorage.setItem("vyastha_greeting", value);
//     setGreeting(value);
//     setEditing(false);
//   };

//    if (!show) return null;

//   return createPortal(
//     <div className="vyastha-welcome-overlay">
//       <div className="vyastha-glow glow-one" />
//       <div className="vyastha-glow glow-two" />
//       <div className="vyastha-welcome-content">
//         {!editing ? (
//           <>
//             <div className="namaste-wrapper">
//               <div className="namaste-line" />
//               <div className="namaste-text">{greeting}</div>
//               <div className="namaste-swoosh" />
//             </div>
//             {userName && <div className="welcome-user">स्वागत है, {userName}</div>}
//             <div className="welcome-brand">Vyastha</div>
//             <div className="welcome-actions">
//               <button className="edit-greeting-btn" onClick={() => setEditing(true)}>
//                 ✦ Edit Greeting
//               </button>
//               <button className="skip-btn" onClick={closeAnimation}>Skip</button>
//             </div>
//           </>
//         ) : (
//           <div className="greeting-editor">
//             <div className="editor-title">Customize your greeting</div>
//             <div className="editor-subtitle">This greeting will appear when you enter Vyastha.</div>
//             <input
//               value={tempGreeting}
//               onChange={(e) => setTempGreeting(e.target.value)}
//               placeholder="नमस्ते"
//               autoFocus
//             />
//             <div className="editor-buttons">
//               <button className="save-btn" onClick={saveGreeting}>Save Greeting</button>
//               <button className="cancel-btn" onClick={() => { setTempGreeting(greeting); setEditing(false); }}>
//                 Cancel
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>,
//     document.body
//   );
// }



import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./WelcomeNamaste.css";

const DEFAULT_GREETING = "नमस्ते";

export default function WelcomeNamaste({ userName = "", onComplete }) {
  const [show, setShow] = useState(true);
  const [editing, setEditing] = useState(false);

  const [greeting, setGreeting] = useState(DEFAULT_GREETING);
  const [tempGreeting, setTempGreeting] = useState(DEFAULT_GREETING);

  useEffect(() => {
    const saved =
      localStorage.getItem("vyastha_greeting") || DEFAULT_GREETING;

    setGreeting(saved);
    setTempGreeting(saved);
  }, []);

  useEffect(() => {
    if (!show || editing) return;

    const timer = setTimeout(closeAnimation, 5800);

    return () => clearTimeout(timer);
  }, [show, editing]);

  const closeAnimation = () => {
    setShow(false);
    onComplete?.();
  };

  const saveGreeting = () => {
    const value = tempGreeting.trim() || DEFAULT_GREETING;

    localStorage.setItem("vyastha_greeting", value);

    setGreeting(value);
    setEditing(false);
  };

  if (!show) return null;

  return createPortal(
    <div className="vyastha-welcome-overlay">
      {/* Background glow */}
      <div className="vyastha-glow glow-one" />
      <div className="vyastha-glow glow-two" />

      <div className="vyastha-welcome-content">
        {!editing ? (
          <>
            {/* Namaste */}
            <div className="namaste-wrapper">
              <div className="namaste-text">{greeting}</div>
              <div className="namaste-swoosh" />
            </div>

            {/* User name */}
            {userName && (
              <div className="welcome-user">
                स्वागत है, {userName}
              </div>
            )}

            {/* Brand */}
            <div className="welcome-brand">Vyastha</div>

            {/* Buttons */}
            <div className="welcome-actions">
              <button
                className="edit-greeting-btn"
                onClick={() => setEditing(true)}
              >
                ✦ Edit Greeting
              </button>

              <button
                className="skip-btn"
                onClick={closeAnimation}
              >
                Skip
              </button>
            </div>
          </>
        ) : (
          /* Greeting Editor */
          <div className="greeting-editor">
            <div className="editor-title">
              Customize your greeting
            </div>

            <div className="editor-subtitle">
              This greeting will appear when you enter Vyastha.
            </div>

            <input
              value={tempGreeting}
              onChange={(e) => setTempGreeting(e.target.value)}
              placeholder="नमस्ते"
              autoFocus
            />

            <div className="editor-buttons">
              <button
                className="save-btn"
                onClick={saveGreeting}
              >
                Save Greeting
              </button>

              <button
                className="cancel-btn"
                onClick={() => {
                  setTempGreeting(greeting);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}