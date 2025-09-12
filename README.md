# Code to run the Red-Green Experiment Locally

Requirements:
- Desktop/Laptop
- Conda
- Git

Step 1: First clone the repo (use https cloning if no ssh key)
```bash
git clone git@github.com:arijit-dasgupta/red_green_experimental_site.git
```

Then install the python requirements in conda

```bash
conda create -n redgreen_exp python=3.11
conda activate redgreen_exp
pip install -r requirements.txt
```


Step 2: Install Node.js and npm (if not already installed)

**For Windows:**
- Download and install Node.js from https://nodejs.org/
- This will automatically include npm

**For macOS:**
- Using Homebrew: `brew install node`
- Or download from https://nodejs.org/

**For Linux (Ubuntu/Debian):**
- Update your package index: `sudo apt update`
- Install Node.js and npm: `sudo apt install nodejs npm`

Step 3: Build the frontend

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

Step 4: Run the experiment and go to the localhost link shown in the terminal (default is http://127.0.0.1:5000)

```bash
python backend/run_redgreen_experiment.py
```

