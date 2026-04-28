import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

function Spinner() {
  return (
    <div
      style={{ display: "flex", justifyContent: "center", padding: "28px 0" }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "4px solid #e0e7ff",
          borderTop: "4px solid #4f46e5",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}

function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      style={{
        background: "#fff5f5",
        border: "1px solid #fed7d7",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ color: "#c53030", fontSize: 14 }}>⚠ {message}</span>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#c53030",
          fontSize: 20,
          lineHeight: 1,
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}

function EmptyState({ icon = "🔍", message }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "#999" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 15 }}>{message}</p>
    </div>
  );
}

function Thumbnail({ fileId }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div
      style={{
        width: "100%",
        height: 130,
        overflow: "hidden",
        background: "#f3f4f6",
        borderRadius: "8px 8px 0 0",
      }}
    >
      <img
        src={`${API}/drive/thumbnail/${fileId}`}
        alt=""
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function ResultsGrid({ results }) {
  return (
    <div style={styles.grid}>
      {results.map((r, i) => (
        <a
          key={i}
          href={r.drive_link}
          target="_blank"
          rel="noreferrer"
          style={{ ...styles.card, padding: 0 }}
        >
          <Thumbnail fileId={r.file_id} />
          <div style={{ padding: "10px 12px" }}>
            <div style={styles.cardScore}>
              {Math.round(r.similarity_score * 100)}% match
            </div>
            <div style={styles.cardName}>{r.file_name}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

export default function App() {
  const [authStatus, setAuthStatus] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  const [activeTab, setActiveTab] = useState("image");
  const [error, setError] = useState(null);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const [textQuery, setTextQuery] = useState("");
  const [enhancedQuery, setEnhancedQuery] = useState(null);

  const [faceResults, setFaceResults] = useState(null);
  const [faceLoading, setFaceLoading] = useState(false);
  const [facePreview, setFacePreview] = useState(null);

  const [scanResults, setScanResults] = useState(null);
  const [scanning, setScanning] = useState(false);

  const [leakedResults, setLeakedResults] = useState(null);
  const [leakedLoading, setLeakedLoading] = useState(false);

  const [folderUrl, setFolderUrl] = useState("");
  const [folderFaceFile, setFolderFaceFile] = useState(null);
  const [folderFacePreview, setFolderFacePreview] = useState(null);
  const [folderResults, setFolderResults] = useState(null);
  const [folderLoading, setFolderLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    axios
      .get(`${API}/auth/status`)
      .then((res) => {
        setAuthStatus(res.data.connected);
        if (res.data.connected) {
          axios
            .get(`${API}/drive/stats`)
            .then((r) => setUserInfo(r.data))
            .catch(() => {});
        }
      })
      .catch(() => setAuthStatus(false));
  }, []);

  const handleLogin = () => {
    window.location.href = `${API}/auth/login`;
  };

  const handleLogout = async () => {
    await axios.get(`${API}/auth/logout`).catch(() => {});
    setAuthStatus(false);
  };

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    setPreviewImage(URL.createObjectURL(file));
    setLoading(true);
    setResults([]);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API}/search/image`, formData);
      setResults(res.data.results ?? []);
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  const onFaceDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    setFacePreview(URL.createObjectURL(file));
    setFaceLoading(true);
    setFaceResults(null);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API}/face/search`, formData);
      setFaceResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setFaceLoading(false);
    }
  };

  const handleTextSearch = async () => {
    if (!textQuery.trim()) return;
    setLoading(true);
    setResults([]);
    setEnhancedQuery(null);
    setError(null);
    try {
      const res = await axios.get(`${API}/search/text`, {
        params: { query: textQuery },
      });
      setResults(res.data.results ?? []);
      setEnhancedQuery(res.data.enhanced_query ?? null);
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityScan = async () => {
    setScanning(true);
    setScanResults(null);
    setError(null);
    try {
      const res = await axios.get(`${API}/security/scan`);
      setScanResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleLeakedScan = async () => {
    setLeakedLoading(true);
    setLeakedResults(null);
    setError(null);
    try {
      const res = await axios.get(`${API}/leaked/scan`);
      setLeakedResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setLeakedLoading(false);
    }
  };

  const onFolderFaceDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    setFolderFaceFile(file);
    setFolderFacePreview(URL.createObjectURL(file));
  };

  const handleFolderSearch = async () => {
    if (!folderUrl.trim() || !folderFaceFile) return;
    setFolderLoading(true);
    setFolderResults(null);
    setError(null);
    const formData = new FormData();
    formData.append("file", folderFaceFile);
    formData.append("folder_url", folderUrl.trim());
    try {
      const res = await axios.post(`${API}/face/search-in-folder`, formData);
      setFolderResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setFolderLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  const {
    getRootProps: getFaceRootProps,
    getInputProps: getFaceInputProps,
    isDragActive: isFaceDragActive,
  } = useDropzone({
    onDrop: onFaceDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  const {
    getRootProps: getFolderFaceRootProps,
    getInputProps: getFolderFaceInputProps,
    isDragActive: isFolderFaceDragActive,
  } = useDropzone({
    onDrop: onFolderFaceDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  if (authStatus === null) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Spinner />
      </div>
    );
  }

  if (!authStatus) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🛡️</div>
          <h1 style={{ fontSize: 34, margin: "0 0 10px", color: "#fafafa" }}>
            DriveGuard
          </h1>
          <p
            style={{
              color: "#666",
              lineHeight: 1.65,
              marginBottom: 32,
              fontSize: 15,
            }}
          >
            AI-powered Google Drive protection — detect leaked sharing links,
            search images by description or face, and scan files for sensitive
            data.
          </p>
          <button style={styles.googleBtn} onClick={handleLogin}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 48 48"
              style={{ marginRight: 10, flexShrink: 0 }}
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.29-8.16 2.29-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            Connect with Google Drive
          </button>
          <p
            style={{
              color: "#bbb",
              fontSize: 12,
              marginTop: 16,
              marginBottom: 0,
            }}
          >
            Read-only access only. Your data never leaves Google.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "image", label: "Search by Image" },
    { id: "text", label: "Search by Text" },
    { id: "face", label: "Face Match" },
    { id: "folder", label: "Find in Folder" },
    { id: "security", label: "PII Scan" },
    { id: "leaked", label: "Leaked Links" },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                margin: 0,
                color: "#fafafa",
                fontWeight: 700,
              }}
            >
              🛡️ DriveGuard
            </h1>
            <p
              style={{
                color: "#888",
                marginTop: 4,
                marginBottom: 0,
                fontSize: 14,
              }}
            >
              AI-powered Google Drive image search &amp; security
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {userInfo?.user_email && (
              <span style={{ fontSize: 13, color: "#999" }}>
                {userInfo.user_email}
              </span>
            )}
            <button style={styles.logoutBtn} onClick={handleLogout}>
              Disconnect Drive
            </button>
          </div>
        </div>
      </div>

      <div style={styles.tabs}>
        {tabs
          .map((tab) => ({
            ...tab,
            isLeaked: tab.id === "leaked",
          }))
          .map((tab) => (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id
                  ? tab.isLeaked
                    ? styles.activeTabRed
                    : styles.activeTab
                  : tab.isLeaked
                    ? styles.tabRed
                    : {}),
              }}
              onClick={() => {
                setActiveTab(tab.id);
                setError(null);
              }}
            >
              {tab.isLeaked ? "🔴 " : ""}
              {tab.label}
            </button>
          ))}
      </div>

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {activeTab === "image" && (
        <div>
          <div
            {...getRootProps()}
            style={{
              ...styles.dropzone,
              background: isDragActive ? "#eef2ff" : "#f8f9fa",
            }}
          >
            <input {...getInputProps()} />
            {previewImage ? (
              <img src={previewImage} alt="preview" style={styles.preview} />
            ) : (
              <>
                <p style={styles.dropText}>📸 Drop an image here</p>
                <p style={styles.dropSub}>
                  or click to select — DriveGuard will find visually similar
                  photos in your Drive
                </p>
              </>
            )}
          </div>
          {loading ? (
            <>
              <Spinner />
              <p style={styles.loadingLabel}>Searching your Drive…</p>
            </>
          ) : results.length > 0 ? (
            <>
              <h2 style={styles.resultsTitle}>
                Found {results.length} matching images
              </h2>
              <ResultsGrid results={results} />
            </>
          ) : previewImage ? (
            <EmptyState
              icon="🔍"
              message="No visually similar images found in your Drive."
            />
          ) : null}
        </div>
      )}

      {activeTab === "text" && (
        <div>
          <p style={styles.tabDesc}>
            Describe the photo you are looking for and DriveGuard will find it
            using AI semantic matching.
          </p>
          <div style={styles.textSearch}>
            <input
              style={styles.input}
              placeholder='e.g. "team photo at conference" or "sunset at the beach"'
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextSearch()}
            />
            <button
              style={styles.button}
              onClick={handleTextSearch}
              disabled={loading}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
          {enhancedQuery && (
            <div style={styles.geminiBox}>
              <span style={styles.geminiLabel}>
                ✨ Gemini enhanced your search:
              </span>
              <p style={styles.geminiText}>{enhancedQuery}</p>
            </div>
          )}
          {loading ? (
            <>
              <Spinner />
              <p style={styles.loadingLabel}>Searching your Drive…</p>
            </>
          ) : results.length > 0 ? (
            <>
              <h2 style={styles.resultsTitle}>
                Found {results.length} matching images
              </h2>
              <ResultsGrid results={results} />
            </>
          ) : textQuery && !loading ? (
            <EmptyState
              icon="🔍"
              message="No matching images found. Try a different description."
            />
          ) : null}
        </div>
      )}

      {activeTab === "face" && (
        <div>
          <p style={styles.tabDesc}>
            Upload a photo of a person and DriveGuard will scan your entire
            Drive to find all photos containing that person.
          </p>
          <div
            {...getFaceRootProps()}
            style={{
              ...styles.dropzone,
              background: isFaceDragActive ? "#eef2ff" : "#f8f9fa",
            }}
          >
            <input {...getFaceInputProps()} />
            {facePreview ? (
              <img
                src={facePreview}
                alt="face preview"
                style={styles.preview}
              />
            ) : (
              <>
                <p style={styles.dropText}>👤 Drop a photo of a person here</p>
                <p style={styles.dropSub}>or click to select</p>
              </>
            )}
          </div>
          {faceLoading ? (
            <>
              <Spinner />
              <p style={{ ...styles.loadingLabel, color: "#4f46e5" }}>
                Scanning all Drive photos for matching faces — this may take a
                minute…
              </p>
            </>
          ) : faceResults ? (
            <>
              <h2 style={styles.resultsTitle}>
                Found {faceResults.total} matching photo
                {faceResults.total !== 1 ? "s" : ""} out of{" "}
                {faceResults.drive_images_checked} checked
              </h2>
              {faceResults.total === 0 ? (
                <EmptyState
                  icon="👤"
                  message="No matching faces found in your Drive."
                />
              ) : (
                <ResultsGrid results={faceResults.matches} />
              )}
            </>
          ) : null}
        </div>
      )}

      {activeTab === "security" && (
        <div>
          <p style={styles.tabDesc}>
            Scans all text-based files in your Drive (Docs, text files) for
            personally identifiable information — emails, phone numbers, credit
            cards, and more.
          </p>
          <button
            style={styles.button}
            onClick={handleSecurityScan}
            disabled={scanning}
          >
            {scanning ? "Scanning…" : "Scan My Drive for Sensitive Data"}
          </button>
          {scanning && (
            <>
              <Spinner />
              <p style={styles.loadingLabel}>
                Scanning your Drive files for PII…
              </p>
            </>
          )}
          {scanResults && !scanning && (
            <div style={{ marginTop: 24 }}>
              <div style={styles.statRow}>
                <div style={styles.statCard}>
                  <span style={styles.statNum}>
                    {scanResults.scanned_files}
                  </span>
                  <span style={styles.statLabel}>Files Scanned</span>
                </div>
                <div style={styles.statCard}>
                  <span
                    style={{
                      ...styles.statNum,
                      color:
                        scanResults.files_with_pii > 0 ? "#e53e3e" : "#38a169",
                    }}
                  >
                    {scanResults.files_with_pii}
                  </span>
                  <span style={styles.statLabel}>Files with PII</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statNum}>
                    {scanResults.skipped_files}
                  </span>
                  <span style={styles.statLabel}>Skipped</span>
                </div>
              </div>
              {scanResults.results.length === 0 ? (
                <EmptyState
                  icon="✅"
                  message="No PII found — your Drive files look clean!"
                />
              ) : (
                scanResults.results.map((file, i) => (
                  <div key={i} style={styles.securityCard}>
                    <div style={styles.securityHeader}>
                      <span style={styles.securityFileName}>
                        {file.file_name}
                      </span>
                      <span style={styles.badgeRed}>
                        {file.findings_count} findings
                      </span>
                    </div>
                    <a
                      href={file.drive_link}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.driveLink}
                    >
                      Open in Drive →
                    </a>
                    <div style={{ marginTop: 10 }}>
                      {file.findings.slice(0, 5).map((f, j) => (
                        <div key={j} style={styles.finding}>
                          <span style={styles.findingType}>
                            {f.entity_type}
                          </span>
                          <span style={styles.findingValue}>{f.value}</span>
                          <span style={styles.findingScore}>
                            {Math.round(f.score * 100)}%
                          </span>
                        </div>
                      ))}
                      {file.findings.length > 5 && (
                        <p
                          style={{
                            color: "#aaa",
                            fontSize: 12,
                            marginTop: 6,
                            marginBottom: 0,
                          }}
                        >
                          +{file.findings.length - 5} more findings
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "folder" && (
        <div>
          <p style={styles.tabDesc}>
            Paste a Google Drive folder link and upload your photo. DriveGuard
            will scan only that folder and find photos containing your face.
          </p>
          <input
            style={{
              ...styles.input,
              marginBottom: 14,
              display: "block",
              width: "100%",
              boxSizing: "border-box",
            }}
            placeholder="https://drive.google.com/drive/folders/..."
            value={folderUrl}
            onChange={(e) => setFolderUrl(e.target.value)}
          />
          <div
            {...getFolderFaceRootProps()}
            style={{
              ...styles.dropzone,
              background: isFolderFaceDragActive ? "#eef2ff" : "#f8f9fa",
              marginBottom: 14,
            }}
          >
            <input {...getFolderFaceInputProps()} />
            {folderFacePreview ? (
              <img
                src={folderFacePreview}
                alt="face preview"
                style={styles.preview}
              />
            ) : (
              <>
                <p style={styles.dropText}>👤 Drop your face photo here</p>
                <p style={styles.dropSub}>or click to select</p>
              </>
            )}
          </div>
          <button
            style={styles.button}
            onClick={handleFolderSearch}
            disabled={folderLoading || !folderUrl.trim() || !folderFaceFile}
          >
            {folderLoading ? "Scanning folder…" : "Search Folder"}
          </button>
          {folderLoading && (
            <>
              <Spinner />
              <p style={{ ...styles.loadingLabel, color: "#4f46e5" }}>
                Scanning folder photos for matching faces…
              </p>
            </>
          )}
          {folderResults && !folderLoading && (
            <>
              <h2 style={styles.resultsTitle}>
                Found {folderResults.total} matching photo
                {folderResults.total !== 1 ? "s" : ""} out of{" "}
                {folderResults.folder_images_checked} checked
              </h2>
              {folderResults.total === 0 ? (
                <EmptyState
                  icon="👤"
                  message="No matching faces found in that folder."
                />
              ) : (
                <div style={styles.grid}>
                  {folderResults.matches.map((r, i) => (
                    <div key={i} style={{ ...styles.card, padding: 0 }}>
                      <Thumbnail fileId={r.file_id} />
                      <div style={{ padding: "10px 12px" }}>
                        <div style={styles.cardScore}>
                          {Math.round(r.similarity_score * 100)}% match
                        </div>
                        <div style={styles.cardName}>{r.file_name}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <a
                            href={r.drive_link}
                            target="_blank"
                            rel="noreferrer"
                            style={{ ...styles.driveLink, fontSize: 12 }}
                          >
                            View →
                          </a>
                          <a
                            href={`${API}/drive/download/${r.file_id}`}
                            download
                            style={{
                              fontSize: 12,
                              color: "#4f46e5",
                              textDecoration: "none",
                              fontWeight: 600,
                            }}
                          >
                            ⬇ Download
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "leaked" && (
        <div>
          <div style={styles.warningBox}>
            <p style={{ margin: 0, fontWeight: 600, color: "#c53030" }}>
              ⚠ Leaked Link Scanner
            </p>
            <p
              style={{
                margin: "8px 0 0",
                color: "#742a2a",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              Finds files shared as <strong>"Anyone with the link"</strong> or{" "}
              <strong>publicly on the web</strong>. Anyone who obtains these
              links can access your files — even outside your organization.
            </p>
          </div>
          <button
            style={{ ...styles.button, background: "#e53e3e" }}
            onClick={handleLeakedScan}
            disabled={leakedLoading}
          >
            {leakedLoading ? "Scanning…" : "🔍 Scan for Leaked Links"}
          </button>
          {leakedLoading && (
            <>
              <Spinner />
              <p style={{ ...styles.loadingLabel, color: "#e53e3e" }}>
                Checking file permissions across your Drive…
              </p>
            </>
          )}
          {leakedResults && !leakedLoading && (
            <div style={{ marginTop: 24 }}>
              <div style={styles.statRow}>
                <div style={styles.statCard}>
                  <span
                    style={{
                      ...styles.statNum,
                      color:
                        leakedResults.leaked_count > 0 ? "#e53e3e" : "#38a169",
                    }}
                  >
                    {leakedResults.leaked_count}
                  </span>
                  <span style={styles.statLabel}>Exposed Files</span>
                </div>
              </div>
              {leakedResults.leaked_count === 0 ? (
                <EmptyState
                  icon="✅"
                  message="No leaked links found — your Drive is secure!"
                />
              ) : (
                <>
                  <p style={{ color: "#666", marginBottom: 14, fontSize: 14 }}>
                    These files have overly permissive sharing settings:
                  </p>
                  {leakedResults.files.map((file, i) => (
                    <div
                      key={i}
                      style={{
                        ...styles.securityCard,
                        borderLeft: `4px solid ${file.risk === "high" ? "#e53e3e" : "#dd6b20"}`,
                      }}
                    >
                      <div style={styles.securityHeader}>
                        <span style={styles.securityFileName}>
                          {file.file_name}
                        </span>
                        <span
                          style={{
                            ...styles.badgeRed,
                            background:
                              file.risk === "high" ? "#fff5f5" : "#fffaf0",
                            color: file.risk === "high" ? "#e53e3e" : "#c05621",
                            border: `1px solid ${file.risk === "high" ? "#fed7d7" : "#fbd38d"}`,
                          }}
                        >
                          {file.risk === "high"
                            ? "🔴 Public"
                            : "🟠 Anyone with link"}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "4px 0 10px",
                          color: "#aaa",
                          fontSize: 12,
                        }}
                      >
                        {file.mime_type || "Unknown type"} · Role: {file.role}
                      </p>
                      <a
                        href={file.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.driveLink}
                      >
                        Open in Drive →
                      </a>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  loginPage: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loginCard: {
    background: "white",
    borderRadius: 20,
    padding: "48px 40px",
    maxWidth: 460,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
  },
  googleBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "14px 24px",
    background: "#4285F4",
    color: "white",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
    boxSizing: "border-box",
  },
  container: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "28px 24px",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: { marginBottom: 24 },
  logoutBtn: {
    padding: "8px 16px",
    background: "transparent",
    border: "1px solid #ddd",
    borderRadius: 8,
    cursor: "pointer",
    color: "#888",
    fontSize: 13,
  },
  tabs: { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" },
  tab: {
    padding: "9px 18px",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    cursor: "pointer",
    background: "white",
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
  },
  activeTab: {
    borderColor: "#4f46e5",
    color: "#4f46e5",
    background: "#eef2ff",
    fontWeight: 600,
  },
  tabRed: { borderColor: "#fed7d7", color: "#c53030" },
  activeTabRed: {
    borderColor: "#e53e3e",
    color: "#e53e3e",
    background: "#fff5f5",
    fontWeight: 600,
  },
  tabDesc: { color: "#666", marginBottom: 18, fontSize: 14, lineHeight: 1.6 },
  dropzone: {
    border: "2px dashed #c7d2fe",
    borderRadius: 12,
    padding: "44px 24px",
    textAlign: "center",
    cursor: "pointer",
    marginBottom: 24,
  },
  dropText: { fontSize: 18, margin: 0, color: "#333", fontWeight: 500 },
  dropSub: { color: "#999", marginTop: 8, marginBottom: 0, fontSize: 13 },
  preview: {
    maxHeight: 180,
    borderRadius: 8,
    display: "block",
    margin: "0 auto",
  },
  textSearch: { display: "flex", gap: 10, marginBottom: 24 },
  input: {
    flex: 1,
    padding: "11px 16px",
    fontSize: 14,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    fontFamily: "inherit",
  },
  button: {
    padding: "11px 22px",
    background: "#4f46e5",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "inherit",
  },
  loadingLabel: {
    textAlign: "center",
    color: "#888",
    fontSize: 14,
    marginTop: 4,
  },
  resultsTitle: {
    marginBottom: 14,
    color: "#333",
    fontSize: 17,
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
    gap: 14,
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 14,
    textDecoration: "none",
    color: "#333",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    display: "block",
  },
  cardScore: {
    background: "#4f46e5",
    color: "white",
    borderRadius: 20,
    padding: "3px 10px",
    fontSize: 12,
    display: "inline-block",
    marginBottom: 8,
    fontWeight: 600,
  },
  cardName: { fontSize: 12, color: "#666", wordBreak: "break-all" },
  statRow: { display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" },
  statCard: {
    flex: 1,
    minWidth: 110,
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "14px 16px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
  },
  statNum: { fontSize: 30, fontWeight: 700, color: "#4f46e5" },
  statLabel: { fontSize: 12, color: "#999", marginTop: 4 },
  securityCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "14px 16px",
    marginBottom: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  securityHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  securityFileName: {
    fontWeight: 600,
    color: "#222",
    fontSize: 14,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginRight: 10,
  },
  badgeRed: {
    background: "#fff5f5",
    color: "#e53e3e",
    border: "1px solid #fed7d7",
    borderRadius: 20,
    padding: "3px 10px",
    fontSize: 12,
    whiteSpace: "nowrap",
    fontWeight: 600,
  },
  driveLink: { color: "#4f46e5", fontSize: 13, textDecoration: "none" },
  finding: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "5px 0",
    borderBottom: "1px solid #f3f4f6",
  },
  findingType: {
    background: "#eff6ff",
    color: "#2563eb",
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
    minWidth: 90,
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  findingValue: {
    flex: 1,
    fontSize: 13,
    color: "#333",
    wordBreak: "break-all",
  },
  findingScore: { fontSize: 12, color: "#aaa", whiteSpace: "nowrap" },
  warningBox: {
    background: "#fff5f5",
    border: "1px solid #fed7d7",
    borderRadius: 10,
    padding: "14px 18px",
    marginBottom: 18,
  },
  geminiBox: {
    background: "#f5f3ff",
    border: "1px solid #ddd6fe",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 18,
  },
  geminiLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#7c3aed",
    letterSpacing: 0.3,
  },
  geminiText: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "#4c1d95",
    lineHeight: 1.6,
  },
};
