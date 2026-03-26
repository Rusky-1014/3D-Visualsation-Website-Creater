<div align="center">
  <br />
  <h1>ThreeStage 🚀<br>The 3D Website Builder SaaS</h1>
  <p><strong>Create stunning, high-performance, scroll-driven 3D product websites with zero code.</strong></p>
  <br />
  
  <p>
    <a href="#demo">View Demo</a> •
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#local-development">Local Setup</a> •
    <a href="#production-deployment">Deploy</a>
  </p>
</div>

<br />

## 🪐 What is ThreeStage?

ThreeStage is a complete, full-stack **SaaS (Software as a Service)** platform designed to revolutionize product marketing. It empowers users to build Apple-style, interactive 3D product visualization websites directly from their browser.

Users can create an account, drag-and-drop `.glb` 3D models into a premium workspace editor, visually position the camera, sequence animation slides, overlay dynamic text, and instantly generate a production-ready `.zip` codebase of their finalized website.

---

## ✨ Core Features

*   **Interactive 3D Editor Engine:** Built with Three.js and vanilla JavaScript to provide instant visual feedback. Adjust X/Y/Z lighting, camera targeting, and model scaling visually.
*   **GSAP Scroll Animations:** The generated websites are automatically infused with complex `ScrollTrigger` animations that smoothly transition camera coordinates between slides as the user scrolls.
*   **Complete SaaS Authentication:** Secure user registration, login, and bespoke Profile Dashboards where users can manage multiple active projects.
*   **Cloud Persistence (MongoDB):** All project configurations, slide coordinates, and user metrics are instantly persisted to a scalable MongoDB Atlas cluster.
*   **Instant Code Generation API:** The backend dynamically compiles massive standalone HTML/CSS/JS bundles and zips them up alongside your `.glb` assets, delivering an automated download immediately upon finalization.
*   **No Code Required:** Fully GUI-driven parameter adjustments.

---

## 🏗️ Technology Stack

We purposely avoided heavy frontend frameworks (like React/Vue) to ensure the core 3D engine remains blazing fast, directly manipulating the DOM, while keeping the output sites incredibly lightweight.

### Frontend
- **HTML5 & CSS3:** Completely custom, vanilla architecture.
- **JavaScript (ES6 Modules):** Modularized for maximum performance.
- **Three.js:** The core 3D WebGL rendering engine.
- **GSAP & ScrollTrigger:** Premium animation and scroll synchronization.

### Backend
- **Node.js & Express:** Robust, scalable RESTful API handling file transmission and code generation.
- **MongoDB Atlas:** Secure NoSQL cloud storage.
- **Archiver & Multer:** Handling real-time asset parsing and dynamic `.zip` file streaming.

---

## 🛠️ Local Development Setup

To run this platform locally on your machine, follow these steps:

**1. Clone the repository**
```bash
git clone https://github.com/Rusky-1014/3D-Visualsation-Website-Creater.git
cd 3D-Visualsation-Website-Creater
```

**2. Install Backend Dependencies**
The backend requires a few structural libraries to run the Node.js API and MongoDB Connections.
```bash
npm install express cors archiver multer mongodb
```

**3. Start the Server**
Boot up the engine locally on port 3000.
```bash
node backend/server.js
```

**4. Open the Platform**
Navigate to `http://localhost:3000/` in your browser. All file uploading, 3D manipulation, and .zip exporting will process via localized `/tmp` file systems instantly.

---

## 🚀 Production Deployment (Render)

This application is built as a highly robust, stateful Node.js application (managing file-system ZIP generations heavily using `fs` and `multer`). Therefore, Serverless platforms (like Vercel or Firebase Functions) with strict read-only filesystems are **not recommended** without swapping the file-storage to AWS S3. 

The easiest, 100% free way to host this complete SaaS is via **Render.com**.

1. Go to **[Render.com](https://render.com/)**, sign up with your GitHub account.
2. Click **New -> Web Service**.
3. Select **"Build and deploy from a Git repository"** and choose this repository.
4. Set the Start Command to:
   ```bash
   node backend/server.js
   ```
5. Select the **Free Tier**, click **Create Web Service**, and within 2 minutes your 3D SaaS Platform is automatically live!

---

<p align="center">
  <i>Engineered with ❤️ for creators everywhere.</i>
</p>
