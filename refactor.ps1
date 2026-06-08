# Comprehensive LABS to Cognitive Lab refactoring script
param(
    [switch]$DryRun
)

$srcDirs = @(
    "C:\Users\CSMC ORISUN MEDIA\Cognitive-Labs-2\src",
    "C:\Users\CSMC ORISUN MEDIA\Cognitive-Labs-2\backend\src"
)

# Collect all JS files
$jsFiles = @()
foreach ($dir in $srcDirs) {
    $jsFiles += Get-ChildItem -Path $dir -Recurse -Filter "*.js" | 
        Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\.git\\' } | 
        ForEach-Object { $_.FullName }
}

# Python files
$pyFiles = @(
    "C:\Users\CSMC ORISUN MEDIA\Cognitive-Labs-2\client.py",
    "C:\Users\CSMC ORISUN MEDIA\Cognitive-Labs-2\create_pr.py",
    "C:\Users\CSMC ORISUN MEDIA\Cognitive-Labs-2\setup.py",
    "C:\Users\CSMC ORISUN MEDIA\Cognitive-Labs-2\__init__.py"
)

# Additional files with LABS references
$additionalFiles = @(
    "C:\Users\CSMC ORISUN MEDIA\Cognitive-Labs-2\examples\usage.js",
    "C:\Users\CSMC ORISUN MEDIA\Cognitive-Labs-2\contracts\stellar\LABSContract.js",
    "C:\Users\CSMC ORISUN MEDIA\Cognitive-Labs-2\scripts\deploy-rust-contracts.js"
)

$allFiles = $jsFiles + $pyFiles + $additionalFiles

function Replace-AllText {
    param([string]$content)
    
    # Ordered replacements - most specific first
    $replacements = @(
        # === PascalCase class/type names ===
        @('LABSService', 'CognitiveLabService'),
        @('LABSContract', 'CognitiveLabContract'),
        @('LABSGenerationCapability', 'CognitiveLabGenerationCapability'),
        @('LABSRegistrationFailed', 'CognitiveLabRegistrationFailed'),
        @('LABSUpdateFailed', 'CognitiveLabUpdateFailed'),
        
        # === camelCase identifiers (longest first) ===
        @('extractPublicKeyFromLABS', 'extractPublicKeyFromCognitiveLab'),
        @('subscribeToLABSCreated', 'subscribeToCognitiveLabCreated'),
        @('subscribeToLABSUpdated', 'subscribeToCognitiveLabUpdated'),
        @('subscribeToLABSDeactivated', 'subscribeToCognitiveLabDeactivated'),
        @('publishLABSEvent', 'publishCognitiveLabEvent'),
        @('executeCreateLABS', 'executeCreateCognitiveLab'),
        @('executeUpdateLABS', 'executeUpdateCognitiveLab'),
        @('executeBridgeLABS', 'executeBridgeCognitiveLab'),
        @('createLABSDocument', 'createCognitiveLabDocument'),
        @('createLABSTransaction', 'createCognitiveLabTransaction'),
        @('createLABSWithDataOperation', 'createCognitiveLabWithDataOperation'),
        @('reconstructLABSFromData', 'reconstructCognitiveLabFromData'),
        @('getLABSFromTransactions', 'getCognitiveLabFromTransactions'),
        @('createLABSOperation', 'createCognitiveLabOperation'),
        @('updateLABSOperation', 'updateCognitiveLabOperation'),
        @('bridgeLABSOperation', 'bridgeCognitiveLabOperation'),
        @('getLABSCacheKey', 'getCognitiveLabCacheKey'),
        @('LABSDocument', 'cognitiveLabDocument'),
        @('LABSMethod', 'cognitiveLabMethod'),
        @('LABSString', 'cognitiveLabString'),
        @('LABSMarker', 'cognitiveLabMarker'),
        @('LABSConfigs', 'cognitiveLabConfigs'),
        @('createLABS', 'createCognitiveLab'),
        @('resolveLABS', 'resolveCognitiveLab'),
        @('updateLABS', 'updateCognitiveLab'),
        @('deactivateLABS', 'deactivateCognitiveLab'),
        @('mockLABSService', 'mockCognitiveLabService'),
        
        # === UPPER_CASE constants ===
        @('CREATE_LABS', 'CREATE_COGNITIVE_LAB'),
        @('UPDATE_LABS', 'UPDATE_COGNITIVE_LAB'),
        @('BRIDGE_LABS', 'BRIDGE_COGNITIVE_LAB'),
        @('LABS_CACHE_TTL', 'COGNITIVE_LAB_CACHE_TTL'),
        @('LABS_CREATED', 'COGNITIVE_LAB_CREATED'),
        @('LABS_UPDATED', 'COGNITIVE_LAB_UPDATED'),
        @('LABS_DEACTIVATED', 'COGNITIVE_LAB_DEACTIVATED'),
        
        # === Channel/topic names ===
        @("LABS_created", "cognitive_lab_created"),
        @("LABS_updated", "cognitive_lab_updated"),
        @("LABS_deactivated", "cognitive_lab_deactivated"),
        
        # === Cache prefix ===
        @("this.cachePrefix = 'LABS:'", "this.cachePrefix = 'cognitiveLab:'"),
        @("this.keyPrefix = 'stellar-LABS:'", "this.keyPrefix = 'cognitive-lab:'"),
        
        # === Data keys ===
        @("LABS_marker", "cognitive_lab_marker"),
        @("stellar_LABS_v1", "cognitive_lab_v1"),
        @("stellar_LABS_registry_v1", "cognitive_lab_registry_v1"),
        @("stellar-LABS-driver", "cognitive-lab-driver"),
        @("stellar-LABS-platform", "cognitive-lab-platform"),
        @("stellar-LABS-backend", "cognitive-lab-backend"),
        @("stellar-LABS-users", "cognitive-lab-users"),
        @("LABS-backend-service", "cognitive-lab-backend-service"),
        @("stellar-LABS-api-cache", "cognitive-lab-api-cache"),
        @("stellar-LABS-offline-v1", "cognitive-lab-offline-v1"),
        
        # === Batch identifiers ===
        @("LABS_create_batch", "cognitive_lab_create_batch"),
        @("LABS_update_batch", "cognitive_lab_update_batch"),
        @("LABS_bridge_batch", "cognitive_lab_bridge_batch"),
        
        # === Python ===
        @("StellarLABSClient", "StellarCognitiveLabClient"),
        @("StellarLABSError", "StellarCognitiveLabError"),
        @("stellar-LABS-sdk", "cognitive-lab-sdk"),
        @("get_LABS", "get_cognitive_lab"),
        @("create_LABS", "create_cognitive_lab"),
        
        # === MongoDB URIs ===
        @("27017/stellar-LABS-test", "27017/cognitive-lab-test"),
        @("27017/stellar-LABS", "27017/cognitive-lab"),
        
        # === File/import paths ===
        @("../services/LABSService", "../services/cognitiveLabService"),
        @("./services/LABSService", "./services/cognitiveLabService"),
        @("../routes/LABS", "../routes/cognitiveLab"),
        @("./routes/LABS", "./routes/cognitiveLab"),
        @("stellar/LABSContract", "stellar/CognitiveLabContract"),
        @("LABSContract.js", "CognitiveLabContract.js"),
        
        # === Route paths (order matters - longest first) ===
        @("/api/batch/LABS/", "/api/batch/cognitive-lab/"),
        @("/api/v1/LABS/", "/api/v1/cognitive-lab/"),
        @("/api/v1/LABS", "/api/v1/cognitive-lab"),
        @("/api/batch/LABS", "/api/batch/cognitive-lab"),
        @("/api/LABS", "/api/cognitive-lab"),
        
        # === Wasm file refs ===
        @("stellar_LABS_contract.wasm", "cognitive_lab_contract.wasm"),
        
        # === Data chunk prefix "LABS_" → "cognitive_lab_" ===
        @("'LABS_'", "'cognitive_lab_'"),
        @('"LABS_"', '"cognitive_lab_"'),
        @("=== 'LABS_marker'", "=== 'cognitive_lab_marker'"),
        
        # === Generic LABS string identifier handling ===
        @("this.LABSMethod = 'stellar'", "this.cognitiveLabMethod = 'stellar'"),
        
        # === User-facing strings ===
        @("Create a new LABS on Stellar", "Create a new Cognitive Lab on Stellar"),
        @("Failed to create LABS:", "Failed to create Cognitive Lab:"),
        @("Failed to resolve LABS:", "Failed to resolve Cognitive Lab:"),
        @("Failed to update LABS:", "Failed to update Cognitive Lab:"),
        @("Failed to create LABS transaction:", "Failed to create Cognitive Lab transaction:"),
        @("Failed to create LABS with data", "Failed to create Cognitive Lab with data"),
        @("Invalid LABS document format", "Invalid Cognitive Lab document format"),
        @("No LABS document found", "No Cognitive Lab document found"),
        @("LABS created successfully", "Cognitive Lab created successfully"),
        @("LABS resolved successfully", "Cognitive Lab resolved successfully"),
        @("LABS updated successfully", "Cognitive Lab updated successfully"),
        @("LABS deactivated successfully", "Cognitive Lab deactivated successfully"),
        @("Create LABS error:", "Create Cognitive Lab error:"),
        @("Resolve LABS error:", "Resolve Cognitive Lab error:"),
        @("Update LABS error:", "Update Cognitive Lab error:"),
        @("Stellar LABS Platform", "Stellar Cognitive Lab Platform"),
        @("Cognitive Lab LABS", "Cognitive Lab"),
        @("Stellar LABS Platform API", "Stellar Cognitive Lab Platform API"),
        @(" - Test Suite", " - Test Suite"),
        @("Test Suite Stellar", "Test Suite Stellar"),
        @("LABS format is incorrect", "Cognitive Lab format is incorrect"),
        @("Failed to register your LABS", "Failed to register your Cognitive Lab"),
        @("This LABS is already registered", "This Cognitive Lab is already registered"),
        @("not authorized to register this LABS", "not authorized to register this Cognitive Lab"),
        @("private key for this LABS.", "private key for this Cognitive Lab."),
        @("Failed to update your LABS document", "Failed to update your Cognitive Lab document"),
        @("LABS not found.", "Cognitive Lab not found."),
        @("register the LABS first", "register the Cognitive Lab first"),
        @("update LABSs you own", "update Cognitive Labs you own"),
        @("Ensure you own this LABS", "Ensure you own this Cognitive Lab"),
        @("The issuer LABS is invalid", "The issuer is invalid"),
        @("The subject LABS is invalid", "The subject is invalid"),
        @("both issuer and subject LABSs are valid", "both issuer and subject are valid"),
        @("LABS query parameter is required", "Cognitive Lab query parameter is required"),
        @("LABS already exists", "Cognitive Lab already exists"),
        @("Cannot update inactive LABS", "Cannot update inactive Cognitive Lab"),
        @("Invalid LABS format", "Invalid Cognitive Lab format"),
        @("Invalid LABS method", "Invalid Cognitive Lab method"),
        @("LABS Verification Service", "Cognitive Lab Verification Service"),
        @("Professional LABS verification", "Professional Cognitive Lab verification"),
        @("LABS document schema", "Cognitive Lab document schema"),
        @("LABS.created", "cognitive-lab.created"),
        @("Stellar Cognitive Lab Platform Test Suite", "Stellar Cognitive Lab Platform Test Suite"),
        @("Stellar Cognitive Lab Platform", "Stellar Cognitive Lab Platform"),
        @("Decentralized-Identity-LABS-", "Decentralized-Identity-Cognitive-Lab-"),
        @("Secret key is required for LABS updates", "Secret key is required for Cognitive Lab updates"),
        
        # === JWT config strings ===
        @("issuer: stellar-LABS-platform", "issuer: cognitive-lab-platform"),
        @("audience: stellar-LABS-users", "audience: cognitive-lab-users"),
        
        # === Remaining general patterns ===
        @("LABSService", "cognitiveLabService"),
        @("LABS.js", "CognitiveLab.js"),
        @("mockLABSService", "mockCognitiveLabService"),
        
        # === Model name 'LABS' ===
        @(" 'LABS'", " 'CognitiveLab'"),
        @('"LABS"', '"CognitiveLab"'),
        
        # === Generic stellar-LABS to cognitive-lab ===
        @("stellar-LABS", "cognitive-lab"),
        @("stellar_LABS", "cognitive_lab"),
        @("STELLAR_LABS", "COGNITIVE_LAB")
    )
    
    $result = $content
    foreach ($r in $replacements) {
        $result = $result -replace [regex]::Escape($r[0]), $r[1]
    }
    
    return $result
}

Write-Host "Processing $($allFiles.Count) files..." -ForegroundColor Cyan

# Track what we changed
$changeLog = @{}
$processedCount = 0

foreach ($file in $allFiles) {
    try {
        $content = Get-Content -Path $file -Raw -ErrorAction Stop
        $newContent = Replace-AllText -content $content
        
        if ($content -ne $newContent) {
            if (-not $DryRun) {
                Set-Content -Path $file -Value $newContent -NoNewline -Force
            }
            Write-Host "  $file" -ForegroundColor Green
            $changeLog["$file"] = @{
                oldLength = $content.Length
                newLength = $newContent.Length
                changes = ($content.Length - $newContent.Length)
            }
            $processedCount++
        }
    } catch {
        Write-Host "  ERROR: $file : $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Processed $processedCount files with changes." -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "DRY RUN - no files were modified." -ForegroundColor Yellow
}

# Output summary
$changeLog
