"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  Database,
  FileHeart,
  FileSearch,
  History,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MessageCircleMore,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import demoStories from "@/data/demo-stories.json";
import { ExtractionPanel } from "./components/ExtractionPanel";
import { ThemeToggle } from "./components/ThemeToggle";
import { TrialCard } from "./components/TrialCard";
import { TRIALS_META } from "@/lib/trials";
import type { MatchResponse } from "@/lib/types";

const TRIAL_COUNT = TRIALS_META.count;
const STORIES = demoStories.stories.slice(0, 5);

export default function PatientPortal() {
  const [text, setText] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  function newSearch() {
    setText("");
    setSubmittedText("");
    setData(null);
    setError(null);
    setHistoryOpen(false);
  }

  function selectStory(story: (typeof STORIES)[number]) {
    setText(story.text);
    setSubmittedText("");
    setData(null);
    setError(null);
    setHistoryOpen(false);
  }

  function editDescription() {
    setText(submittedText);
    setSubmittedText("");
    setData(null);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
  }

  async function submit() {
    if (text.trim().length < 10) {
      setError("Please describe your situation in a sentence or two.");
      return;
    }

    const story = text.trim();
    setSubmittedText(story);
    setText("");
    setLoading(true);
    setError(null);
    setData(null);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: story }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      setData(json as MatchResponse);
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          resultsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const matches = data?.results.filter((result) => result.verdict !== "excluded") ?? [];
  const nearMisses = data?.nearMisses ?? [];

  return (
    <main className="ct-chat-canvas">
      <div className="ct-chat-shell">
        <aside className="ct-chat-rail" aria-label="Primary navigation">
          <button type="button" onClick={newSearch} className="ct-chat-brand" aria-label="New ClearTrial search" title="New search">
            <Activity className="h-5 w-5" />
          </button>
          <nav className="ct-chat-rail-nav">
            <button type="button" onClick={newSearch} className="ct-chat-rail-button" aria-label="New search" title="New search">
              <Plus className="h-[18px] w-[18px]" />
            </button>
            <span className="ct-chat-rail-button is-active" aria-label="Patient matching" title="Patient matching">
              <MessageCircleMore className="h-[18px] w-[18px]" />
            </span>
            <Link href="/dashboard" className="ct-chat-rail-button" aria-label="Protocol intelligence" title="Protocol intelligence">
              <BarChart3 className="h-[18px] w-[18px]" />
            </Link>
            <span className="ct-chat-rail-button is-muted" title="Eligibility evidence">
              <FileSearch className="h-[18px] w-[18px]" />
            </span>
          </nav>
          <ThemeToggle compact />
        </aside>

        <div className={`ct-history-scrim ${historyOpen ? "is-open" : ""}`} onClick={() => setHistoryOpen(false)} />
        <aside className={`ct-chat-history ${historyOpen ? "is-open" : ""}`} aria-label="Sample search history">
          <div className="ct-history-header">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="ct-history-kicker">ClearTrial</p>
                <h1>Search history</h1>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)} className="ct-mobile-close" aria-label="Close search history">
                <X className="h-5 w-5" />
              </button>
            </div>
            <button type="button" onClick={newSearch} className="ct-history-new">
              <Plus className="h-4 w-4" />
              New search
            </button>
          </div>

          <div className="ct-history-list">
            <p className="ct-history-day">Sample patients</p>
            {STORIES.map((story, index) => (
              <button key={story.id} type="button" onClick={() => selectStory(story)} className={`ct-history-card ${text === story.text ? "is-selected" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`ct-history-icon tone-${index % 3}`}>
                    {index === 0 ? <FileHeart className="h-4 w-4" /> : <History className="h-4 w-4" />}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ct-text-soft)]" />
                </div>
                <strong>{story.title.split(" — ")[0]}</strong>
                <span>{story.title.split(" — ")[1]}</span>
                <p>{story.text}</p>
              </button>
            ))}
          </div>

          <div className="ct-history-trust">
            <ShieldCheck className="h-4 w-4" />
            <span>Sample stories are synthetic. Your search text is not stored.</span>
          </div>
        </aside>

        <section className="ct-conversation">
          <header className="ct-conversation-header">
            <button type="button" onClick={() => setHistoryOpen(true)} className="ct-mobile-menu" aria-label="Open search history">
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p>{data ? "Trial matches" : "New search"}</p>
              <span>{TRIAL_COUNT} recruiting studies</span>
            </div>
            <Link href="/dashboard" className="ct-conversation-action" aria-label="Open researcher view" title="Researcher view">
              <BarChart3 className="h-[18px] w-[18px]" />
            </Link>
          </header>

          <div ref={scrollRef} className="ct-conversation-scroll">
            <div className="ct-conversation-inner">
              <section className="ct-chat-greeting">
                <div className="ct-assistant-portrait">
                  <FileHeart className="h-7 w-7" />
                </div>
                <div>
                  <p>Hi, I&apos;m ClearTrial.</p>
                  <h2>How can I help you find a clinical trial?</h2>
                </div>
              </section>

              {!submittedText && (
                <section className="ct-chat-tools" aria-label="ClearTrial capabilities">
                  <article className="ct-chat-tool tone-lilac">
                    <Database className="h-5 w-5" />
                    <strong>Live trials</strong>
                    <span>{TRIAL_COUNT} recruiting studies from ClinicalTrials.gov</span>
                  </article>
                  <article className="ct-chat-tool tone-mint">
                    <CheckCircle2 className="h-5 w-5" />
                    <strong>Clear reasons</strong>
                    <span>See what matched, failed, or needs confirmation</span>
                  </article>
                  <article className="ct-chat-tool tone-neutral">
                    <LockKeyhole className="h-5 w-5" />
                    <strong>Private by design</strong>
                    <span>Your story is never stored in the signal dashboard</span>
                  </article>
                </section>
              )}

              {submittedText && (
                <section className="ct-user-message">
                  <p>{submittedText}</p>
                  <div className="ct-message-actions">
                    <button type="button" onClick={editDescription} aria-label="Edit your description" title="Edit description">
                      <FileSearch className="h-4 w-4" />
                    </button>
                  </div>
                </section>
              )}

              {loading && (
                <section className="ct-assistant-message" aria-live="polite">
                  <div className="ct-mini-avatar"><Sparkles className="h-4 w-4" /></div>
                  <div className="ct-reading-steps">
                    {["Reading your description", "Finding clinical concepts", "Checking published eligibility"].map((step, index) => (
                      <div key={step} style={{ animation: `ct-fade 400ms ease-out ${index * 220}ms both` }}>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        {step}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {data && (
                <section ref={resultsRef} className="ct-assistant-results scroll-mt-4">
                  <div className="ct-results-intro">
                    <div className="ct-mini-avatar"><Sparkles className="h-4 w-4" /></div>
                    <div>
                      <p>I checked your description against the published eligibility criteria.</p>
                      <h2>{matches.length > 0 ? `${Math.min(matches.length, 5)} studies are worth asking about.` : "I did not find a clear match yet."}</h2>
                    </div>
                  </div>

                  <div className="ct-profile-strip">
                    <div className="ct-profile-strip-header">
                      <div>
                        <span>What I understood</span>
                        <strong>Clinical profile</strong>
                      </div>
                      <small>{data.usedFallback ? "offline" : `${(data.elapsedMs / 1000).toFixed(1)}s`}</small>
                    </div>
                    <ExtractionPanel profile={data.profile} />
                  </div>

                  <div className="ct-result-section">
                    <div className="ct-result-heading">
                      <div>
                        <span>Recommended studies</span>
                        <h3>{matches.length > 0 ? "Best evidence-backed matches" : "No clear matches"}</h3>
                      </div>
                      <small>Ranked by fit and coverage</small>
                    </div>
                    <div className="space-y-3">
                      {matches.slice(0, 5).map((result) => <TrialCard key={result.trial.nctId} result={result} />)}
                    </div>
                  </div>

                  {nearMisses.length > 0 && (
                    <div className="ct-result-section">
                      <div className="ct-result-heading">
                        <div>
                          <span>Near matches</span>
                          <h3>One criterion away from {nearMisses.length} other {nearMisses.length === 1 ? "study" : "studies"}</h3>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {nearMisses.map((result) => (
                          <div key={result.trial.nctId} className="space-y-2">
                            <TrialCard result={result} />
                            {result.blockers[0] && (
                              <div className="ct-exclusion-quote">
                                <strong>Exact exclusion language</strong>
                                <p>“{result.blockers[0].source}”</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="ct-medical-note">
                    <ShieldCheck className="h-4 w-4" />
                    <p>ClearTrial is an eligibility pre-screen, not medical advice. A study team makes the final determination.</p>
                  </div>
                </section>
              )}
            </div>
          </div>

          <footer className="ct-conversation-footer">
            <div className="ct-chat-composer">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit();
                }}
                rows={2}
                aria-label="Describe your diagnosis and treatment history"
                placeholder="Describe your diagnosis, treatment history, and recent results..."
              />
              <div className="ct-chat-composer-actions">
                <button type="button" onClick={() => selectStory(STORIES[0])} className="ct-example-button">
                  <Sparkles className="h-3.5 w-3.5" />
                  Example
                </button>
                <button type="button" onClick={submit} disabled={loading} className="ct-chat-send" aria-label={loading ? "Finding trials" : "Find trials"}>
                  {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {error && <p className="ct-composer-error">{error}</p>}
          </footer>
        </section>
      </div>
    </main>
  );
}
