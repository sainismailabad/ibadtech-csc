$files = Get-ChildItem -Recurse -Include *.html,*.js,*.css

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $modified = $false
    
    if ($content -match 'foodie-cart') {
        $content = $content -replace 'foodie-cart', 'foodz-cart'
        $modified = $true
    }
    
    if ($content -match 'foodie-last-location') {
        $content = $content -replace 'foodie-last-location', 'foodz-last-location'
        $modified = $true
    }
    
    if ($content -match 'Foodie\.') {
        $content = $content -replace 'Foodie\.', 'Foodz.'
        $modified = $true
    }
    
    if ($content -match 'Foodie\)') {
        $content = $content -replace 'Foodie\)', 'Foodz)'
        $modified = $true
    }
    
    if ($content -match '\bFoodie\b') {
        $content = $content -replace '(?<!\w)Foodie(?!\w)', 'Foodz'
        $modified = $true
    }
    
    if ($modified) {
        Set-Content $f.FullName $content -NoNewline
        Write-Host 'Updated:' $f.FullName
    }
}
Write-Host "Done with all remaining replacements."