# Arrears Business Line Integration - Quick Checklist

## Pre-Integration Preparation
- [ ] Business line name decided (e.g., `marine`, `travel`, `fire`)
- [ ] Excel file format confirmed with required columns
- [ ] Folder naming convention decided
- [ ] PDF template requirements defined

## Backend Configuration (CRITICAL)

### 1. Update `backend/routes/arrears.js`
- [ ] Add new entry to `PRODUCT_CONFIG` object
- [ ] Verify all folder paths use `../` prefix
- [ ] Ensure `inputFile` name matches actual Excel file
- [ ] Ensure `generator` and `merger` script names are correct

```javascript
// Template to copy and modify:
newproduct: {
    name: 'New Product Insurance',
    inputFile: 'NewProduct_Arrears.xlsx',
    generator: 'NewProduct_L0.py',
    merger: 'merge_newproduct_pdfs.py',
    outputFolders: {
        L0: '../NewProduct_L0',
        L1: '../NewProduct_L1',
        L2: '../NewProduct_L2',
        MED: '../NewProduct_MED'
    },
    mergedFolders: {
        L0: '../NewProduct_L0_Merge',
        L1: '../NewProduct_L1_Merge',
        L2: '../NewProduct_L2_Merge',
        MED: '../NewProduct_MED_Merge'
    }
}
```

## Frontend Configuration

### 2. Update `frontend/src/components/arrears/ArrearsDashboard.jsx`
- [ ] Add new entry to `productTypeConfig` object
- [ ] Choose appropriate color hex code
- [ ] Choose appropriate emoji icon
- [ ] Write clear description

```javascript
// Template to copy and modify:
newproduct: {
    name: 'New Product Insurance',
    inputFile: 'NewProduct_Arrears.xlsx',
    color: '#your-hex-color',
    icon: '🔷',
    description: 'New product insurance arrears processing'
}
```

## Script Creation

### 3. Create Generator Script `backend/NewProduct_L0.py`
- [ ] Copy from existing script (e.g., `NonMotor_L0.py`)
- [ ] Update Excel file name in `pd.read_excel()`
- [ ] Update output folder name to match backend config
- [ ] Map Excel columns to your business line structure
- [ ] Update PDF content (logos, bank accounts, etc.)
- [ ] Test script independently

**Key Points**:
```python
# Must match backend config exactly
output_folder = "NewProduct_L0"  # Match outputFolders.L0

# Excel file must match backend config
df = pd.read_excel("NewProduct_Arrears.xlsx", engine='openpyxl')
```

### 4. Create Merger Script `backend/merge_newproduct_pdfs.py`
- [ ] Copy from existing script (e.g., `merge_nonmotor_pdfs.py`)
- [ ] Update input folder to match generator output
- [ ] Update output folder to match backend config
- [ ] Update merged filename prefix
- [ ] Test script independently

**Key Points**:
```python
# Must match backend config exactly
input_folder = "NewProduct_L0"    # Match outputFolders.L0
output_folder = "NewProduct_L0_Merge"  # Match mergedFolders.L0
```

## Folder Structure

### 5. Create Required Folders in `backend/`
- [ ] `NewProduct_L0/` (for individual PDFs)
- [ ] `NewProduct_L0_Merge/` (for merged PDFs)
- [ ] Additional folders if using L1, L2, MED levels

## File Preparation

### 6. Excel File Setup
- [ ] Create `backend/NewProduct_Arrears.xlsx`
- [ ] Ensure required columns exist:
  - [ ] Policy Number column
  - [ ] Policy Holder column  
  - [ ] Outstanding Amount column
  - [ ] Address columns
- [ ] Test with sample data (5-10 records)

## Testing Phase

### 7. Backend Testing
- [ ] Start backend server
- [ ] Check console for configuration errors
- [ ] Test generator script: `python NewProduct_L0.py`
- [ ] Verify PDFs created in correct folder
- [ ] Test merger script: `python merge_newproduct_pdfs.py`
- [ ] Verify merged PDF created

### 8. Frontend Testing
- [ ] Start frontend
- [ ] New product appears in dropdown
- [ ] Upload Excel file works
- [ ] Generate letters works
- [ ] File count shows correctly
- [ ] Merge letters works
- [ ] Downloads work (individual and merged)

### 9. Integration Testing
- [ ] Complete workflow: Upload → Generate → Merge → Download
- [ ] File cleanup works (old files removed)
- [ ] Progress tracking works
- [ ] Error handling works

## Common Issues Quick Fix

### Issue: "0 files generated" but PDFs exist
**Fix**: Check folder paths in backend config match actual folders

### Issue: Download fails
**Fix**: Ensure productType parameter is passed in API calls

### Issue: Script not found
**Fix**: Check script filename in backend config matches actual file

### Issue: Excel read error
**Fix**: Check Excel filename and column mappings in generator script

### Issue: Old files not deleted
**Fix**: Backend now handles this automatically, but verify folder names match

## Deployment Checklist

### 10. Pre-Deployment
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Sample Excel file provided to users
- [ ] User training completed

### 11. Post-Deployment
- [ ] Monitor first production run
- [ ] Verify file counts and downloads
- [ ] Check for any error logs
- [ ] User feedback collected

## Quick Reference - File Locations

```
backend/
├── routes/arrears.js           # Add PRODUCT_CONFIG
├── NewProduct_L0.py           # Generator script
├── merge_newproduct_pdfs.py   # Merger script
├── NewProduct_Arrears.xlsx    # Input file
├── NewProduct_L0/             # Individual PDFs
└── NewProduct_L0_Merge/       # Merged PDFs

frontend/src/components/arrears/
└── ArrearsDashboard.jsx       # Add productTypeConfig
```

## Time Estimates

- **Backend Config**: 5 minutes
- **Frontend Config**: 5 minutes  
- **Script Creation**: 30-60 minutes
- **Testing**: 30 minutes
- **Total**: 1.5-2 hours for complete integration

---

**Print this checklist and check off items as you complete them!**