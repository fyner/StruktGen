const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    resizable: false,
    frame: true, // naudojame custom header, bet dabar be lango valdymo mygtukų
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadFile(path.join(__dirname, 'public', 'index.html'));
}

function createMenu() {
  const template = [
    {
      label: 'Programa',
      submenu: [
        {
          label: 'Nustatymai',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.loadFile(path.join(__dirname, 'public', 'settings.html'));
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Išeiti',
          click: () => { app.quit(); }
        }
      ]
    },
    {
      label: 'Pagalba',
      submenu: [
        {
          label: 'Info',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.loadFile(path.join(__dirname, 'public', 'info.html'));
            }
          }
        },
        {
          label: 'Apie',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.loadFile(path.join(__dirname, 'public', 'about.html'));
            }
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createMenu();
});

// Settings failas – saugomas root direktorijoje (šalia main.js)
const settingsPath = path.join(__dirname, 'settings.json');

function loadSettings() {
  const defaultSettings = {};
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      try {
        return JSON.parse(data);
      } catch (parseErr) {
        console.error("Nustatymų failas sugadintas, atstatoma numatytoji reikšmė.", parseErr);
        saveSettings(defaultSettings);
        return defaultSettings;
      }
    } else {
      saveSettings(defaultSettings);
      return defaultSettings;
    }
  } catch (err) {
    console.error("Klaida įkeliant nustatymus:", err);
    return defaultSettings;
  }
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error("Nepavyko išsaugoti nustatymų:", err);
  }
}

ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (event, settings) => saveSettings(settings));

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const settings = loadSettings();
    settings.folderPath = result.filePaths[0];
    saveSettings(settings);
    return result.filePaths[0];
  }
  return null;
});

// Pagalbinės funkcijos failų/katalogų kūrimui:
function hasExtension(name) {
  return /\.[^/.]+$/.test(name);
}

function isValidDirectoryName(name) {
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
  if (invalidChars.test(name)) return false;
  if (name.endsWith('.') || name.endsWith(' ')) return false;
  if (name.trim() === '') return false;
  return true;
}

function extractContent(token) {
  let content = null;
  let fileName = token;
  const squareStart = token.indexOf('[');
  const squareEnd = token.indexOf(']');
  const curlyStart = token.indexOf('{');
  const curlyEnd = token.indexOf('}');
  if (squareStart !== -1 && squareEnd !== -1 && squareEnd > squareStart) {
    content = token.substring(squareStart + 1, squareEnd);
    fileName = token.substring(0, squareStart);
  } else if (curlyStart !== -1 && curlyEnd !== -1 && curlyEnd > curlyStart) {
    content = token.substring(curlyStart + 1, curlyEnd);
    fileName = token.substring(0, curlyStart);
  }
  return { fileName: fileName.trim(), content };
}

ipcMain.handle('create-files', async (event, { folderPath, inputText }) => {
  const baseFolder = folderPath;
  const sequences = inputText.split(',').map(seq => seq.trim()).filter(seq => seq);
  let results = [];
  for (const seq of sequences) {
    const tokens = seq.split('>').map(token => token.trim()).filter(token => token);
    if (tokens.length === 0) continue;
    let currentPath = baseFolder;
    let errorOccurred = false;
    for (let i = 0; i < tokens.length - 1; i++) {
      let { fileName } = extractContent(tokens[i]);
      if (hasExtension(fileName)) {
        results.push(`Klaida: tokenas "${tokens[i]}" viduryje atrodo kaip failas.`);
        errorOccurred = true;
        break;
      }
      if (!isValidDirectoryName(fileName)) {
        results.push(`Klaida: neteisingas katalogo pavadinimas "${fileName}".`);
        errorOccurred = true;
        break;
      }
      currentPath = path.join(currentPath, fileName);
      try {
        if (!fs.existsSync(currentPath)) {
          fs.mkdirSync(currentPath);
          results.push(`Katalogas "${fileName}" sukurtas.`);
        }
      } catch (err) {
        results.push(`Klaida kuriant katalogą "${fileName}": ${err.message}`);
        errorOccurred = true;
        break;
      }
    }
    if (errorOccurred) continue;
    const lastToken = tokens[tokens.length - 1];
    let { fileName, content } = extractContent(lastToken);
    if (hasExtension(fileName)) {
      const filePath = path.join(currentPath, fileName);
      try {
        fs.writeFileSync(filePath, content || '');
        results.push(`Failas "${fileName}" sukurtas${content ? " su turiniu." : "."}`);
      } catch (err) {
        results.push(`Klaida kuriant failą "${fileName}": ${err.message}`);
      }
    } else {
      if (!isValidDirectoryName(fileName)) {
        results.push(`Klaida: neteisingas katalogo pavadinimas "${fileName}".`);
        continue;
      }
      currentPath = path.join(currentPath, fileName);
      try {
        if (!fs.existsSync(currentPath)) {
          fs.mkdirSync(currentPath, { recursive: true });
          results.push(`Nested katalogų seka "${tokens.join('/')}" sukurta.`);
        } else {
          results.push(`Katalogas "${fileName}" jau egzistuoja.`);
        }
      } catch (err) {
        results.push(`Klaida kuriant katalogą "${fileName}": ${err.message}`);
      }
    }
  }
  return results;
});
