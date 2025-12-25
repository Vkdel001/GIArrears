# Arrears System Troubleshooting Guide

## Quick Diagnostic Commands

### Check File Counts
```bash
# Windows PowerShell
Get-ChildItem "backend/Motor_L0" -Filter "*.pdf" | Measure-Object | Select-Object -ExpandProperty Count
Get-ChildItem "backend/Motor_L0_Merge" -Filter "*.pdf" | Measure-Object | Select-Object -ExpandProperty Count

# Linux/Mac
ls backend/Motor_L0/*.pdf | wc -l
ls backend/Motor_L0_Merge/*.pdf | wc -l
```

### Check Folder Structure
```bash
# List all arrears-related folders
ls -la backend/ | grep -E "(L0|Merge|Motor|Health|NonMotor)"
```

## Common Issues and Solutions

### 1. Frontend Shows "0 Files Generated" But PDFs Exist

**Symptoms**:
- PDFs visible in backend folders
- Frontend dashboard shows 0 files
- Generate button shows "PDFs Generated ✓" but count is wrong

**Root Cause**: Folder path mismatch between backend config and actual folders

**Solution**:
1. Check backend configuration in `backend/routes/arrears.js`:
```javascript
// Verify these paths match actual folders
outputFolders: {
    L0: '../Motor_L0',  // Must match actual folder name
    // ...
}
```

2. Check actual folder names:
```bash
ls backend/ | grep L0
```

3. Ensure paths use `../` prefix in backend config

**Prevention**: Always verify folder paths match between config and filesystem

---

### 2. Old Files Not Being Deleted

**Symptoms**:
- Upload 10 records, see 469 files
- Old merged PDFs still visible
- File counts don't reset

**Root Cause**: Cleanup not working properly

**Solution**:
1. **Automatic Fix** (Latest Version): Backend now handles cleanup automatically
2. **Manual Fix**: Use cleanup endpoint:
```javascript
// Call cleanup API
POST /api/arrears/cleanup
Body: { "productType": "nonmotor" }
```

3. **Emergency Manual Cleanup**:
```bash
# Delete all PDFs from folders
rm backend/Motor_L0/*.pdf
rm backend/Motor_L0_Merge/*.pdf
```

**Prevention**: Ensure backend cleanup code is present in generate/merge routes

---

### 3. Script Not Found Error

**Symptoms**:
- Error: "NonMotor_L0.py script not found"
- Generation fails immediately

**Root Cause**: Script filename mismatch in backend config

**Solution**:
1. Check backend config:
```javascript
nonmotor: {
    generator: 'NonMotor_L0.py',  // Must match actual filename
    merger: 'merge_nonmotor_pdfs.py',
    // ...
}
```

2. Check actual filenames:
```bash
ls backend/*.py | grep -i motor
```

3. Rename files or update config to match

**Prevention**: Use exact filenames in backend configuration

---

### 4. Excel File Read Errors

**Symptoms**:
- "Excel file not found" error
- Script fails at pandas.read_excel()

**Root Cause**: Excel filename or location mismatch

**Solution**:
1. Check backend config:
```javascript
nonmotor: {
    inputFile: 'NonMotor_Arrears.xlsx',  // Must match actual filename
    // ...
}
```

2. Check file exists:
```bash
ls backend/NonMotor_Arrears.xlsx
ls backend/uploads/arrears/NonMotor_Arrears.xlsx
```

3. Verify script reads correct filename:
```python
df = pd.read_excel("NonMotor_Arrears.xlsx", engine='openpyxl')
```

**Prevention**: Ensure consistent naming across config, script, and actual files

---

### 5. Download Failures

**Symptoms**:
- Download links don't work
- 404 errors on download
- Wrong files downloaded

**Root Cause**: ProductType not passed to download URLs

**Solution**:
1. Check frontend API calls include productType:
```javascript
arrearsAPI.downloadIndividual(type, filename, productType);
```

2. Verify backend download routes use config:
```javascript
const config = getProductConfig(productType);
const filePath = path.join(__dirname, config.outputFolders[type], filename);
```

**Prevention**: Always pass productType parameter in download functions

---

### 6. PDF Generation Fails

**Symptoms**:
- Script runs but no PDFs created
- Python errors during generation
- Incomplete PDF files

**Root Cause**: Various script issues

**Solution**:
1. **Test script independently**:
```bash
cd backend
python NonMotor_L0.py
```

2. **Check common issues**:
   - Missing font files (`fonts/cambria.ttf`)
   - Missing logo files (`NICLOGO.jpg`, `isphere_logo.jpg`)
   - Invalid Excel data (missing columns)
   - Insufficient permissions

3. **Check output folder**:
```python
# Ensure folder creation works
output_folder = "Motor_L0"
os.makedirs(output_folder, exist_ok=True)
```

**Prevention**: Test scripts independently before integration

---

### 7. Merge Process Fails

**Symptoms**:
- Individual PDFs exist but merge fails
- "No PDF files found" error
- Corrupted merged PDFs

**Root Cause**: Merger script issues

**Solution**:
1. **Test merger independently**:
```bash
cd backend
python merge_nonmotor_pdfs.py
```

2. **Check PyMuPDF installation**:
```bash
pip install PyMuPDF
```

3. **Verify folder paths**:
```python
input_folder = "Motor_L0"      # Must match generator output
output_folder = "Motor_L0_Merge"  # Must match backend config
```

**Prevention**: Test merger script with sample PDFs

---

### 8. Progress Not Updating

**Symptoms**:
- Progress bar stuck at 0%
- No progress messages
- Frontend doesn't show completion

**Root Cause**: Progress polling issues

**Solution**:
1. **Check backend progress updates**:
```javascript
// Ensure updateProgress is called
updateProgress('running', 50, 'Processing...', 'generate');
```

2. **Check frontend polling**:
```javascript
// Verify polling interval is active
const interval = setInterval(pollProgress, 1000);
```

3. **Check browser console** for API errors

**Prevention**: Monitor browser network tab during operations

---

### 9. Authentication Issues

**Symptoms**:
- "Arrears team access required" error
- Redirected to login unexpectedly

**Root Cause**: Session or team access issues

**Solution**:
1. **Check user team assignment**:
```javascript
// In backend/routes/auth.js
const arrearsTeam = ['collections@nicl.mu', 'vkdel001@gmail.com'];
```

2. **Verify session is active**:
```bash
# Check browser cookies for session
```

3. **Re-login if necessary**

**Prevention**: Ensure proper team assignment in auth configuration

---

### 10. Performance Issues

**Symptoms**:
- Very slow PDF generation
- Timeouts during processing
- Browser becomes unresponsive

**Root Cause**: Large datasets or resource constraints

**Solution**:
1. **Check file size**:
```bash
wc -l backend/NonMotor_Arrears.xlsx  # Count records
```

2. **Monitor resource usage** during processing

3. **Consider batch processing** for very large files (>5000 records)

4. **Increase timeouts** if necessary:
```javascript
timeout: 7200000 // 2 hours
```

**Prevention**: Test with representative data sizes

---

## Diagnostic Tools

### Backend Logs
Monitor backend console output for:
- File cleanup messages
- Script execution status
- Error messages
- Progress updates

### Frontend Debugging
Use browser developer tools:
- **Console**: JavaScript errors
- **Network**: API call failures
- **Application**: Session storage

### File System Checks
Regular verification commands:
```bash
# Check all arrears folders
find backend -name "*L0*" -type d
find backend -name "*Merge*" -type d

# Count PDFs in each folder
for dir in backend/*L0*; do echo "$dir: $(ls $dir/*.pdf 2>/dev/null | wc -l)"; done
```

## Emergency Recovery

### Complete System Reset
If system is in inconsistent state:

1. **Stop all processes**
2. **Clear all PDF folders**:
```bash
rm backend/Motor_L0/*.pdf
rm backend/Motor_L0_Merge/*.pdf
rm backend/L0/*.pdf
rm backend/L0_Merge/*.pdf
# ... repeat for all folders
```

3. **Clear uploaded files**:
```bash
rm backend/uploads/arrears/*
rm backend/*.xlsx
```

4. **Restart backend server**
5. **Refresh frontend**
6. **Start fresh workflow**

### Backup Important Files
Before major changes:
```bash
# Backup configuration
cp backend/routes/arrears.js backend/routes/arrears.js.backup
cp frontend/src/components/arrears/ArrearsDashboard.jsx frontend/src/components/arrears/ArrearsDashboard.jsx.backup

# Backup working scripts
cp backend/NonMotor_L0.py backend/NonMotor_L0.py.backup
cp backend/merge_nonmotor_pdfs.py backend/merge_nonmotor_pdfs.py.backup
```

## Prevention Best Practices

1. **Always test scripts independently** before integration
2. **Verify folder paths** match between config and filesystem  
3. **Use consistent naming** across all components
4. **Monitor file counts** during development
5. **Keep backups** of working configurations
6. **Test with small datasets** first
7. **Document any customizations** made

---

**When in doubt, refer to the Integration Guide and follow the checklist step by step!**