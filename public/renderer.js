$(document).ready(function(){
  window.electronAPI.getSettings().then(function(settings){
    if(!settings.folderPath){
      $('#resultsArea').html('<p class="text-danger">Nėra nustatyto aplanko kelio! Eikite į meniu "Programa > Nustatymai" ir pasirinkite aplanką.</p>');
    }
  });
  
  $('#createBtn').click(function(){
    window.electronAPI.getSettings().then(function(settings){
      const folderPath = settings.folderPath;
      if(!folderPath){
        alert("Nėra nustatyto aplanko kelio! Eikite į meniu 'Programa > Nustatymai' ir pasirinkite aplanką.");
        return;
      }
      const structureText = $('#structureInput').val();
      window.electronAPI.createFiles(folderPath, structureText).then(function(results){
        const resultsArea = $('#resultsArea');
        resultsArea.empty();
        if(results && results.length > 0){
          const table = $(`
            <table class="table table-striped table-hover">
              <thead>
                <tr>
                  <th style="width: 50px;">#</th>
                  <th>Rezultatas</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>`);
          $.each(results, function(index, res){
            const tr = $(`<tr><td>${index+1}</td><td>${res}</td></tr>`);
            table.find('tbody').append(tr);
          });
          resultsArea.append(table);
        } else {
          resultsArea.append('<p class="text-muted">Rezultatų kol kas nėra.</p>');
        }
      });
    });
  });
});
