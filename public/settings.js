$(document).ready(function(){
  window.electronAPI.getSettings().then(function(settings){
    if(settings.folderPath){
      $('#settingsFolderPath').val(settings.folderPath);
    }
  });

  $('#settingsChooseFolderBtn').click(function(){
    window.electronAPI.selectFolder().then(function(folder){
      if(folder){
        $('#settingsFolderPath').val(folder);
      }
    });
  });

  $('#saveSettingsBtn').click(function(){
    const folderPath = $('#settingsFolderPath').val();
    window.electronAPI.saveSettings({ folderPath: folderPath }).then(function(){
      window.location.href = 'index.html';
    });
  });
});
