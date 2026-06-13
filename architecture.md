# Architectural Summary: E2E Tender Agentic Platform (Revised)

This document outlines the revised architectural decisions for building a snappy, intelligent, and visually interactive Tender Agentic Platform. The goal is to move beyond Workspace-centric interfaces to a dedicated web application that provides a seamless, real-time experience.

## 1. Core Principle: "Interactive Dashboard for Real-Time Insights"
Instead of leveraging Google Workspace as the primary UI, the platform uses a custom-built dashboard to provide a high-fidelity, interactive experience.

*   **UI/Frontend**: Next.js 14 (App Router) with Tailwind CSS for styling and Framer Motion for workflow visualizations.
*   **Backend/Brain**: Next.js API Routes (Serverless) act as the orchestrator, communicating with Gemini 1.5 Pro (via Google AI SDK) for analysis and matchmaking.

## 2. Technical Stack
The stack is chosen for rapid development and "snappiness."

*   **Framework**: Next.js (React-based) – allows for a unified frontend and backend codebase.
*   **Styling**: Tailwind CSS – for fast, responsive UI development.
*   **Animations**: Framer Motion – to visually represent the "thinking" process and transitions between workflow stages.
*   **State Management**: Local file-based state (e.g., JSON/SQLite) for the hackathon MVP, designed for easy migration to a cloud database (Postgres/Firestore) for production.
*   **Intelligence**: Gemini 1.5 Pro – used for RFQ parsing, clarification generation, and resource matchmaking.

## 3. Workflow Visualization: The E2E Pipeline
The UI is built around a 4-stage visual pipeline to keep the user informed of the agent's progress.

1.  **Ingestion Stage**:
    *   **Action**: User uploads RFQ (PDF/Doc).
    *   **Visual**: Immediate parsing feedback, progress bars, and metadata extraction display.
2.  **Analysis & Clarification Stage**:
    *   **Action**: Agent analyzes the RFQ and identifies ambiguities.
    *   **Visual**: A real-time "Thought Log" showing the agent's reasoning. Interactive Q&A cards for the human to answer agent questions.
3.  **Planning & Matchmaking Stage**:
    *   **Action**: Agent matches RFQ requirements against employee profiles.
    *   **Visual**: A visual "Match Board" showing fit scores, required skills vs. available resources, and timeline projections.
4.  **Execution & Outreach Stage**:
    *   **Action**: System initiates contact with selected employees.
    *   **Visual**: A tracking dashboard showing employee response status and outreach progress.

## 4. State & Communication Model
To ensure "sub-second" feel, the architecture prioritizes low-latency interactions.

*   **API Interaction**: RESTful endpoints for state transitions and Gemini calls.
*   **Real-time Feedback**: Use of Server-Sent Events (SSE) or optimized polling to update the UI as the backend agent completes tasks.
*   **Data Structure**: Centralized `ProjectState` object that tracks the status of every stage, allowing the user to refresh or return to a job-in-progress.

## 5. Development & Deployment
*   **Local Development**: Standard Node.js/NPM workflow.
*   **Version Control**: Git-based development.
*   **Deployment**: Ready for containerization (Docker) or serverless deployment (Vercel/Google Cloud Run).
