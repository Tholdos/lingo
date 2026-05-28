# Merge OpenTaal wordlist with existing words_big.txt and filter for Lingo game
# Keep only words with 5-10 letters, convert to uppercase

Write-Host "Merging word lists..."

# Read both word lists
$opentaal = Get-Content "c:\Projecten\Hobby\lingo-web\public\wordlists\opentaal_wordlist.txt"
$existing = Get-Content "c:\Projecten\Hobby\lingo-web\public\wordlists\words_big.txt"

# Combine and remove duplicates
$combined = $opentaal + $existing | Select-Object -Unique

Write-Host "Combined list has $($combined.Count) unique words"

# Filter for game requirements:
# - 5 to 10 letters only
# - No words with spaces (for game simplicity)
# - Convert to uppercase
# - Remove words with special characters that might cause issues

$filtered = $combined | Where-Object {
    $word = $_
    $length = $word.Length
    
    # Check length (5-10 characters)
    if ($length -lt 5 -or $length -gt 10) {
        return $false
    }
    
    # Exclude words with spaces (multi-word entries)
    if ($word -match "\s") {
        return $false
    }
    
    # Accept word
    return $true
} | ForEach-Object { $_.ToUpper() } | Select-Object -Unique | Sort-Object

Write-Host "Filtered list has $($filtered.Count) words (5-10 letters, no spaces)"
Write-Host "Saving to words_big.txt..."

# Save to new words_big.txt
$filtered | Out-File -FilePath "c:\Projecten\Hobby\lingo-web\public\wordlists\words_big.txt" -Encoding UTF8

Write-Host "Done! New words_big.txt created with $($filtered.Count) words"

# Check if LUISJE is in the list
$hasLuisje = $filtered | Where-Object { $_ -eq "LUISJE" }
if ($hasLuisje) {
    Write-Host "✓ LUISJE is in the list!"
} else {
    Write-Host "✗ LUISJE is NOT in the list"
}
