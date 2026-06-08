param(
    [string]$FileList = "files_to_edit.txt",
    [switch]$DryRun = $false
)

$files = Get-Content -LiteralPath $FileList
$totalFiles = $files.Count
$modifiedCount = 0
$logLines = @()

foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file)) {
        Write-Warning "File not found: $file"
        continue
    }

    $content = Get-Content -LiteralPath $file -Raw
    $original = $content
    $fileName = [System.IO.Path]::GetFileName($file)
    $ext = [System.IO.Path]::GetExtension($file)

    Write-Host "Processing: $fileName"

    # ============================================
    # REPLACEMENT RULES
    # Ordered from most specific to least specific
    # ============================================

    # --- Contract names (longest first) ---
    $replacements = @()

    if ($ext -eq '.sol') {
        # Contract/struct/interface names
        $replacements += @(
            @{ Old = 'UltraGasOptimizedLABSRegistry'; New = 'UltraGasOptimizedCognitiveLabRegistry' },
            @{ Old = 'OptimizedUpgradeableLABSRegistry'; New = 'OptimizedUpgradeableCognitiveLabRegistry' },
            @{ Old = 'EnhancedLABSGovernanceToken'; New = 'EnhancedCognitiveLabGovernanceToken' },
            @{ Old = 'EnhancedLABSGovernor'; New = 'EnhancedCognitiveLabGovernor' },
            @{ Old = 'GasOptimizedLABSRegistry'; New = 'GasOptimizedCognitiveLabRegistry' },
            @{ Old = 'OptimizedLABSRegistry'; New = 'OptimizedCognitiveLabRegistry' },
            @{ Old = 'EnhancedLABSRegistry'; New = 'EnhancedCognitiveLabRegistry' },
            @{ Old = 'IntegratedLABSRegistry'; New = 'IntegratedCognitiveLabRegistry' },
            @{ Old = 'StellarLABSRegistry'; New = 'StellarCognitiveLabRegistry' },
            @{ Old = 'EthereumLABSRegistry'; New = 'EthereumCognitiveLabRegistry' },
            @{ Old = 'LABSGovernanceToken'; New = 'CognitiveLabGovernanceToken' },
            @{ Old = 'LABSGovernor'; New = 'CognitiveLabGovernor' },
            @{ Old = 'LABSTimelock'; New = 'CognitiveLabTimelock' },
            @{ Old = 'LABSProxyFactory'; New = 'CognitiveLabProxyFactory' },
            @{ Old = 'LABSProxy'; New = 'CognitiveLabProxy' },

            # Struct names
            @{ Old = 'UltraLABSDocument'; New = 'UltraCognitiveLabDocument' },
            @{ Old = 'LABSDocument'; New = 'CognitiveLabDocument' },
            @{ Old = 'LABSOwner'; New = 'CognitiveLabOwner' },

            # Interface names
            @{ Old = 'ILABSRegistry'; New = 'ICognitiveLabRegistry' },

            # Modifier names
            @{ Old = 'onlyLABSOwner'; New = 'onlyCognitiveLabOwner' },
            @{ Old = 'onlyValidLABS'; New = 'onlyValidCognitiveLab' },

            # Function names (longer first)
            @{ Old = 'createLABSFor'; New = 'createCognitiveLabFor' },
            @{ Old = 'createLABS'; New = 'createCognitiveLab' },
            @{ Old = 'updateLABS'; New = 'updateCognitiveLab' },
            @{ Old = 'getLABSOwner'; New = 'getCognitiveLabOwner' },
            @{ Old = 'getLABSDocument'; New = 'getCognitiveLabDocument' },
            @{ Old = 'getLABS'; New = 'getCognitiveLab' },
            @{ Old = 'deactivateLABS'; New = 'deactivateCognitiveLab' },
            @{ Old = 'deleteLABS'; New = 'deleteCognitiveLab' },
            @{ Old = 'activateLABS'; New = 'activateCognitiveLab' },
            @{ Old = 'recoverLABS'; New = 'recoverCognitiveLab' },
            @{ Old = 'migrateLABS'; New = 'migrateCognitiveLab' },
            @{ Old = 'bridgeLABS'; New = 'bridgeCognitiveLab' },
            @{ Old = 'transferLABS'; New = 'transferCognitiveLab' },
            @{ Old = 'grantLABS'; New = 'grantCognitiveLab' },
            @{ Old = 'revokeLABS'; New = 'revokeCognitiveLab' },

            # Event names
            @{ Old = 'LABSCreated'; New = 'CognitiveLabCreated' },
            @{ Old = 'LABSUpdated'; New = 'CognitiveLabUpdated' },
            @{ Old = 'LABSDeactivated'; New = 'CognitiveLabDeactivated' },
            @{ Old = 'LABSTransferred'; New = 'CognitiveLabTransferred' },
            @{ Old = 'LABSBridged'; New = 'CognitiveLabBridged' },
            @{ Old = 'LABSRecovered'; New = 'CognitiveLabRecovered' },
            @{ Old = 'LABSMigrated'; New = 'CognitiveLabMigrated' },
            @{ Old = 'LABSGranted'; New = 'CognitiveLabGranted' },
            @{ Old = 'LABSRevoked'; New = 'CognitiveLabRevoked' },

            # Error names (longer first)
            @{ Old = 'LABSAlreadyExists'; New = 'CognitiveLabAlreadyExists' },
            @{ Old = 'LABSNotDeactivated'; New = 'CognitiveLabNotDeactivated' },
            @{ Old = 'LABSNotBridged'; New = 'CognitiveLabNotBridged' },
            @{ Old = 'LABSNotSupported'; New = 'CognitiveLabNotSupported' },
            @{ Old = 'LABSNotFound'; New = 'CognitiveLabNotFound' },
            @{ Old = 'LABSInvalid'; New = 'CognitiveLabInvalid' },
            @{ Old = 'LABSActive'; New = 'CognitiveLabActive' },
            @{ Old = 'LABSNotActive'; New = 'CognitiveLabNotActive' },
            @{ Old = 'LABSDeactivated'; New = 'CognitiveLabDeactivated' },
            @{ Old = 'LABSTransferFailed'; New = 'CognitiveLabTransferFailed' },
            @{ Old = 'LABSRecoveryFailed'; New = 'CognitiveLabRecoveryFailed' },
            @{ Old = 'LABSRevokeFailed'; New = 'CognitiveLabRevokeFailed' },
            @{ Old = 'LABSManageFailed'; New = 'CognitiveLabManageFailed' },

            # Variable names (longer first)
            @{ Old = 'newLABSOwner'; New = 'newCognitiveLabOwner' },
            @{ Old = 'previousLABSOwner'; New = 'previousCognitiveLabOwner' },
            @{ Old = 'newLABSOwner'; New = 'newCognitiveLabOwner' },
            @{ Old = 'previousLABSOwner'; New = 'previousCognitiveLabOwner' },
            @{ Old = 'LABSDocuments'; New = 'cognitiveLabDocuments' },
            @{ Old = 'LABSRegistry'; New = 'cognitiveLabRegistry' },
            @{ Old = 'LABSDocument'; New = 'cognitiveLabDocument' },
            @{ Old = 'LABSCount'; New = 'cognitiveLabCount' },
            @{ Old = 'LABSId'; New = 'cognitiveLabId' },
            @{ Old = 'LABSOwner'; New = 'cognitiveLabOwner' },

            # Enum values
            @{ Old = 'LABS_CREATE'; New = 'COGNITIVE_LAB_CREATE' },
            @{ Old = 'LABS_UPDATE'; New = 'COGNITIVE_LAB_UPDATE' },
            @{ Old = 'LABS_TRANSFER'; New = 'COGNITIVE_LAB_TRANSFER' },
            @{ Old = 'LABS_DELETE'; New = 'COGNITIVE_LAB_DELETE' },
            @{ Old = 'LABS_MIGRATE'; New = 'COGNITIVE_LAB_MIGRATE' },
            @{ Old = 'LABS_BRIDGE'; New = 'COGNITIVE_LAB_BRIDGE' },
            @{ Old = 'LABS_RECOVER'; New = 'COGNITIVE_LAB_RECOVER' },

            # Constants
            @{ Old = 'BASE_LABS_CREATE'; New = 'BASE_COGNITIVE_LAB_CREATE' },
            @{ Old = 'BASE_LABS_UPDATE'; New = 'BASE_COGNITIVE_LAB_UPDATE' },
            @{ Old = 'BASE_LABS_TRANSFER'; New = 'BASE_COGNITIVE_LAB_TRANSFER' },
            @{ Old = 'BASE_LABS_DELETE'; New = 'BASE_COGNITIVE_LAB_DELETE' },
            @{ Old = 'BASE_LABS_RECOVER'; New = 'BASE_COGNITIVE_LAB_RECOVER' },
            @{ Old = 'BASE_LABS_MIGRATE'; New = 'BASE_COGNITIVE_LAB_MIGRATE' },
            @{ Old = 'BASE_LABS_BRIDGE'; New = 'BASE_COGNITIVE_LAB_BRIDGE' },
            @{ Old = 'ADDITIONAL_LABS_CHILD'; New = 'ADDITIONAL_COGNITIVE_LAB_CHILD' },

            # Token names
            @{ Old = 'LABS Governance Token'; New = 'Cognitive Lab Governance Token' },
            @{ Old = 'LABSGT'; New = 'CLGT' },
            @{ Old = 'ELABSGT'; New = 'ECLGT' },
            @{ Old = 'eLABSGT'; New = 'eCLGT' },

            # Comments - replace standalone "LABS" in comments with "Cognitive Lab"
            # But NOT inside `LABS:` URIs
            @{ Old = '// LABS '; New = '// Cognitive Lab ' },
            @{ Old = '/// LABS '; New = '/// Cognitive Lab ' },
            @{ Old = '//LABS '; New = '//Cognitive Lab ' },
            @{ Old = '///LABS '; New = '///Cognitive Lab ' },
            @{ Old = '* LABS '; New = '* Cognitive Lab ' },
            @{ Old = '@dev LABS '; New = '@dev Cognitive Lab ' },
            @{ Old = '@notice LABS '; New = '@notice Cognitive Lab ' },
            @{ Old = '@param LABS '; New = '@param Cognitive Lab ' },
            @{ Old = '@return LABS '; New = '@return Cognitive Lab ' },
            @{ Old = '@title LABS '; New = '@title Cognitive Lab ' },
            @{ Old = '//  LABS '; New = '//  Cognitive Lab ' },
            @{ Old = '@dev LABS'; New = '@dev Cognitive Lab' },  # at end of line
            @{ Old = 'the LABS'; New = 'the Cognitive Lab' },
            @{ Old = 'The LABS'; New = 'The Cognitive Lab' },
            @{ Old = 'a LABS '; New = 'a Cognitive Lab ' },
            @{ Old = 'A LABS '; New = 'A Cognitive Lab ' },
            @{ Old = 'LABS document'; New = 'Cognitive Lab document' },
            @{ Old = 'LABS Document'; New = 'Cognitive Lab Document' },
            @{ Old = 'LABS-related'; New = 'Cognitive Lab-related' },
            @{ Old = 'LABS-based'; New = 'Cognitive Lab-based' },
            @{ Old = 'LABS operations'; New = 'Cognitive Lab operations' },
            @{ Old = 'LABS operation'; New = 'Cognitive Lab operation' },
            @{ Old = 'LABS creation'; New = 'Cognitive Lab creation' },
            @{ Old = 'LABS update'; New = 'Cognitive Lab update' },
            @{ Old = 'LABS deactivation'; New = 'Cognitive Lab deactivation' },
            @{ Old = 'LABS deletion'; New = 'Cognitive Lab deletion' },
            @{ Old = 'LABS recovery'; New = 'Cognitive Lab recovery' },
            @{ Old = 'LABS migration'; New = 'Cognitive Lab migration' },
            @{ Old = 'LABS bridging'; New = 'Cognitive Lab bridging' },
            @{ Old = 'LABS transfer'; New = 'Cognitive Lab transfer' },
            @{ Old = 'LABS LABS'; New = 'Cognitive Lab LABS' },  # will be caught later
            @{ Old = 'a LABS.'; New = 'a Cognitive Lab.' },
            @{ Old = 'the LABS.'; New = 'the Cognitive Lab.' },
            @{ Old = 'A LABS.'; New = 'A Cognitive Lab.' },

            # Handle file-level comments referencing "LABS registry"
            @{ Old = 'LABS registry'; New = 'Cognitive Lab registry' },
            @{ Old = 'LABS Registry'; New = 'Cognitive Lab Registry' },
            @{ Old = 'LABS system'; New = 'Cognitive Lab system' },
            @{ Old = 'LABS contract'; New = 'Cognitive Lab contract' },
            @{ Old = 'LABS Contract'; New = 'Cognitive Lab Contract' },
            @{ Old = 'LABS function'; New = 'Cognitive Lab function' },
            @{ Old = 'LABS identifier'; New = 'Cognitive Lab identifier' },
            @{ Old = 'LABS record'; New = 'Cognitive Lab record' },

            # String literals
            @{ Old = '"LABS:stellar:'; New = '"cognitive-lab:stellar:' },
            @{ Old = '"LABS:example:'; New = '"cognitive-lab:example:' },
            @{ Old = '"LABS:ethr:'; New = '"cognitive-lab:ethr:' },
            @{ Old = '"LABS:key:'; New = '"cognitive-lab:key:' },
            @{ Old = '"LABS:web:'; New = '"cognitive-lab:web:' },
            @{ Old = '"LABS:'; New = '"cognitive-lab:' }
        )
    }
    elseif ($ext -eq '.rs') {
        $replacements += @(
            @{ Old = 'LABSContractClient'; New = 'CognitiveLabContractClient' },
            @{ Old = 'LABSContract'; New = 'CognitiveLabContract' },
            @{ Old = 'LABSDocument'; New = 'CognitiveLabDocument' },
            @{ Old = 'LABSOwner'; New = 'CognitiveLabOwner' },
            @{ Old = 'LABSCreated'; New = 'CognitiveLabCreated' },
            @{ Old = 'LABSUpdated'; New = 'CognitiveLabUpdated' },
            @{ Old = 'LABSAlreadyExists'; New = 'CognitiveLabAlreadyExists' },
            @{ Old = 'LABSNotFound'; New = 'CognitiveLabNotFound' },
            @{ Old = 'LABS(Bytes'; New = 'CognitiveLab(Bytes' },

            # Variable names
            @{ Old = 'LABS_owner'; New = 'cognitive_lab_owner' },
            @{ Old = 'LABS_key'; New = 'cognitive_lab_key' },
            @{ Old = 'LABS_doc'; New = 'cognitive_lab_doc' },
            @{ Old = 'LABSs_map'; New = 'cognitive_labs_map' },
            @{ Old = 'LABS_entries'; New = 'cognitive_lab_entries' },
            @{ Old = 'LABS_entry'; New = 'cognitive_lab_entry' },
            @{ Old = 'LABS_data'; New = 'cognitive_lab_data' },

            # Function names (longer first)
            @{ Old = 'get_LABS_document'; New = 'get_cognitive_lab_document' },
            @{ Old = 'get_LABS_owner'; New = 'get_cognitive_lab_owner' },
            @{ Old = 'create_LABS'; New = 'create_cognitive_lab' },
            @{ Old = 'update_LABS'; New = 'update_cognitive_lab' },
            @{ Old = 'get_LABS'; New = 'get_cognitive_lab' },
            @{ Old = 'deactivate_LABS'; New = 'deactivate_cognitive_lab' },
            @{ Old = 'delete_LABS'; New = 'delete_cognitive_lab' },
            @{ Old = 'has_LABS'; New = 'has_cognitive_lab' },

            # Error variants
            @{ Old = 'LABSNotFound'; New = 'CognitiveLabNotFound' },
            @{ Old = 'LABSAlreadyExists'; New = 'CognitiveLabAlreadyExists' },

            # Comments
            @{ Old = '// LABS '; New = '// Cognitive Lab ' },
            @{ Old = '/// LABS '; New = '/// Cognitive Lab ' },
            @{ Old = '//LABS '; New = '//Cognitive Lab ' },
            @{ Old = 'the LABS'; New = 'the Cognitive Lab' },
            @{ Old = 'The LABS'; New = 'The Cognitive Lab' },
            @{ Old = 'a LABS '; New = 'a Cognitive Lab ' },
            @{ Old = 'A LABS '; New = 'A Cognitive Lab ' },
            @{ Old = 'LABS document'; New = 'Cognitive Lab document' },
            @{ Old = 'LABS Document'; New = 'Cognitive Lab Document' },
            @{ Old = 'LABS identifier'; New = 'Cognitive Lab identifier' },
            @{ Old = 'LABS contract'; New = 'Cognitive Lab contract' },
            @{ Old = 'LABS Contract'; New = 'Cognitive Lab Contract' },

            # String literals
            @{ Old = '"LABS:stellar:'; New = '"cognitive-lab:stellar:' },
            @{ Old = '"LABS:example:'; New = '"cognitive-lab:example:' },
            @{ Old = '"LABS:'; New = '"cognitive-lab:' }
        )
    }

    # Apply all replacements
    foreach ($r in $replacements) {
        $content = $content -replace [regex]::Escape($r.Old), $r.New
    }

    # Now handle remaining standalone "LABS" in comments and as whole word
    # Use regex for standalone word boundary replacements in comments
    # For .sol files, handle `//` and `///` comments
    if ($ext -eq '.sol') {
        # Replace standalone "LABS" word in comments with "Cognitive Lab"
        # This regex matches "LABS" as a whole word in comment lines only
        $lines = $content -split "`r`n|`n"
        $newLines = @()
        foreach ($line in $lines) {
            # Check if this is a comment line
            if ($line -match '^\s*///?\s') {
                # In comment lines, replace "LABS" as a whole word
                $line = $line -replace '(?<!\w)LABS(?!\w)', 'Cognitive Lab'
            }
            $newLines += $line
        }
        $content = $newLines -join "`r`n"
    }
    elseif ($ext -eq '.rs') {
        # Same for Rust comments
        $lines = $content -split "`r`n|`n"
        $newLines = @()
        foreach ($line in $lines) {
            if ($line -match '^\s*//') {
                $line = $line -replace '(?<!\w)LABS(?!\w)', 'Cognitive Lab'
            }
            $newLines += $line
        }
        $content = $newLines -join "`r`n"
    }

    # Write changes if content differs
    if ($content -ne $original) {
        if (-not $DryRun) {
            # Use UTF-8 without BOM for .sol and .rs files
            if ($ext -eq '.sol') {
                Set-Content -LiteralPath $file -Value $content -NoNewline -Encoding UTF8
            }
            elseif ($ext -eq '.rs') {
                Set-Content -LiteralPath $file -Value $content -NoNewline -Encoding UTF8
            }
            else {
                Set-Content -LiteralPath $file -Value $content -NoNewline -Encoding UTF8
            }
        }
        $modifiedCount++
        # Count the number of replacements (rough diff)
        $diffCount = [regex]::Matches($original, 'LABS').Count - [regex]::Matches($content, 'LABS').Count
        $logLine = "MODIFIED: $fileName - Changed $diffCount LABS references"
        $logLines += $logLine
        Write-Host "  $logLine"
    }
    else {
        Write-Host "  No changes needed (or file is empty)"
    }
}

Write-Host "`n=== Summary ==="
Write-Host "Total files scanned: $totalFiles"
Write-Host "Files modified: $modifiedCount"
foreach ($l in $logLines) {
    Write-Host "  $l"
}
