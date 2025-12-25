# Collections & Recovery Enhancement - Dual Product Support

## 📋 Project Overview

**Enhancement Type**: Feature Addition  
**Target System**: Collections & Recovery Module  
**Scope**: Add support for Non-Motors Insurance alongside existing Health Insurance  
**Impact**: Medium - New functionality with minimal changes to existing code  

## 🎯 Business Requirements

### Current State
- Collections & Recovery system processes **Health Insurance** arrears only
- Uses single input file: `Extracted_Arrears_Data.xlsx`
- Generates PDFs using `L0.py` script
- Merges PDFs using `arrears_merger.py`

### Desired State
- Support **both Health and Non-Motors Insurance** arrears processing
- Unified user interface with product type selection
- Separate processing pipelines for each product type
- Maintain existing Health functionality without changes

## 🔄 System Architecture Changes

### Frontend Enhancements

#### 1. Product Type Selection
```
┌─────────────────────────────────────┐
│  Collections & Recovery Dashboard   │
├─────────────────────────────────────┤
│  Select Product Type: [Dropdown ▼] │
│  ├─ Health Insurance               │
│  └─ Non-Motors Insurance           │
└─────────────────────────────────────┘
```

#### 2. Confirmation Flow
```
User Flow:
1. Select Product Type → 2. Upload File → 3. Confirm Selection → 4. Process
```

### Backend Processing Paths

#### Health Insurance Path (Existing)
```
Input: Extracted_Arrears_Data.xlsx
  ↓
Generator: L0.py
  ↓
Output: L0/, L1/, L2/, output_mise_en_demeure/
  ↓
Merger: arrears_merger.py
  ↓
Merged: L0_Merge/, L1_Merge/, L2_Merge/, MED_Merge/
```

#### Non-Motors Path (New)
```
Input: NonMotor_Arrears.xls
  ↓
Generator: NonMotor_L0.py
  ↓
Output: NonMotor_L0/, NonMotor_L1/, NonMotor_L2/, NonMotor_MED/
  ↓
Merger: merge_nonmotor_pdfs.py
  ↓
Merged: NonMotor_L0_Merge/, NonMotor_L1_Merge/, NonMotor_L2_Merge/, NonMotor_MED_Merge/
```

## 📁 File Structure Changes

### New Files to Create

```
backend/
├── NonMotor_L0.py                   # Non-motor PDF generator (based on L0.py)
├── merge_nonmotor_pdfs.py           # Non-motor PDF merger (based on arrears_merger.py)
├── NonMotor_L0/                     # Individual L0 PDFs output
├── NonMotor_L1/                     # Individual L1 PDFs output (future)
├── NonMotor_L2/                     # Individual L2 PDFs output (future)
├── NonMotor_MED/                    # Individual MED PDFs output (future)
├── NonMotor_L0_Merge/               # Merged L0 PDFs
├── NonMotor_L1_Merge/               # Merged L1 PDFs (future)
├── NonMotor_L2_Merge/               # Merged L2 PDFs (future)
└── NonMotor_MED_Merge/              # Merged MED PDFs (future)

root/
└── NonMotor_Arrears.xls             # Non-motor input data file
```

### Files to Modify

```
frontend/src/
├── components/arrears/ArrearsDashboard.jsx  # Add product type selector
└── services/api.js                          # Add product-specific API calls

backend/
├── routes/arrears.js                        # Add product type routing logic
└── server.js                               # Update route configurations (if needed)
```

## 🔧 Technical Implementation

### Phase 1: Core Backend Scripts

#### A. NonMotor_L0.py Creation
**Base Template**: Copy from `L0.py`  
**Key Modifications**:
- Input file: `NonMotor_Arrears.xls` instead of `Extracted_Arrears_Data.xlsx`
- Column mappings: Adapt to Non-Motor Excel structure
- Output folder: `NonMotor_L0/` instead of `L0/`
- Product-specific formatting and branding
- QR code merchant ID (if different)

#### B. merge_nonmotor_pdfs.py Creation
**Base Template**: Copy from `arrears_merger.py`  
**Key Modifications**:
- Source folder: `NonMotor_L0/` instead of `L0/`
- Output folder: `NonMotor_L0_Merge/` instead of `L0_Merge/`
- Filename pattern: `Merged_NonMotor_L0_Arrears_{timestamp}.pdf`

### Phase 2: Frontend Enhancements

#### A. Product Type Selector Component
```jsx
// New component or enhancement to existing dashboard
const ProductTypeSelector = () => {
  const [productType, setProductType] = useState('');
  
  return (
    <div className="product-selector">
      <label>Select Product Type:</label>
      <select value={productType} onChange={handleProductTypeChange}>
        <option value="">-- Select Product Type --</option>
        <option value="health">Health Insurance</option>
        <option value="nonmotor">Non-Motors Insurance</option>
      </select>
    </div>
  );
};
```

#### B. Confirmation Dialog
```jsx
const ConfirmationDialog = ({ productType, fileName, onConfirm, onCancel }) => {
  return (
    <div className="confirmation-dialog">
      <h3>Confirm Processing</h3>
      <p>Product Type: <strong>{productType}</strong></p>
      <p>Input File: <strong>{fileName}</strong></p>
      <p>This will generate arrears letters for {productType} customers.</p>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onConfirm}>Confirm & Generate</button>
    </div>
  );
};
```

### Phase 3: API Enhancements

#### A. New API Endpoints
```javascript
// Enhanced arrears API with product type support
POST /api/arrears/:productType/upload-excel
POST /api/arrears/:productType/generate-letters
POST /api/arrears/:productType/merge-letters
GET  /api/arrears/:productType/files
GET  /api/arrears/:productType/status
GET  /api/arrears/:productType/progress
GET  /api/arrears/:productType/download/:type/:filename
```

#### B. Route Handler Logic
```javascript
// Product type configuration
const PRODUCT_CONFIG = {
  health: {
    name: "Health Insurance",
    inputFile: "Extracted_Arrears_Data.xlsx",
    generator: "L0.py",
    merger: "arrears_merger.py",
    outputFolders: ["L0", "L1", "L2", "output_mise_en_demeure"],
    mergedFolders: ["L0_Merge", "L1_Merge", "L2_Merge", "MED_Merge"]
  },
  nonmotor: {
    name: "Non-Motors Insurance",
    inputFile: "NonMotor_Arrears.xls",
    generator: "NonMotor_L0.py",
    merger: "merge_nonmotor_pdfs.py",
    outputFolders: ["NonMotor_L0", "NonMotor_L1", "NonMotor_L2", "NonMotor_MED"],
    mergedFolders: ["NonMotor_L0_Merge", "NonMotor_L1_Merge", "NonMotor_L2_Merge", "NonMotor_MED_Merge"]
  }
};
```

## 🎨 User Experience Flow

### Step-by-Step User Journey

#### 1. Dashboard Access
```
User logs in → Collections & Recovery Dashboard → Product Type Selection
```

#### 2. Product Selection
```
┌─────────────────────────────────────┐
│ Select Product Type:                │
│ ┌─────────────────────────────────┐ │
│ │ Health Insurance            ▼   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Options:                            │
│ • Health Insurance                  │
│ • Non-Motors Insurance              │
└─────────────────────────────────────┘
```

#### 3. File Upload (Dynamic)
```
Health Selected:
┌─────────────────────────────────────┐
│ Upload Health Insurance Data        │
│ Expected file: Extracted_Arrears_   │
│ Data.xlsx                           │
│ [Choose File] [Upload]              │
└─────────────────────────────────────┘

Non-Motors Selected:
┌─────────────────────────────────────┐
│ Upload Non-Motors Insurance Data    │
│ Expected file: NonMotor_Arrears.xls │
│ [Choose File] [Upload]              │
└─────────────────────────────────────┘
```

#### 4. Confirmation Dialog
```
┌─────────────────────────────────────┐
│ ⚠️  Confirm Processing               │
├─────────────────────────────────────┤
│ Product Type: Non-Motors Insurance  │
│ Input File: NonMotor_Arrears.xls    │
│                                     │
│ This will generate arrears letters  │
│ for Non-Motors customers.           │
│                                     │
│ Are you sure you want to proceed?   │
│                                     │
│ [Cancel]  [Confirm & Generate]      │
└─────────────────────────────────────┘
```

#### 5. Processing (Same UI, Different Backend)
```
┌─────────────────────────────────────┐
│ 🔄 Processing Non-Motors Arrears    │
├─────────────────────────────────────┤
│ ████████████░░░░░░░░ 60%            │
│                                     │
│ Status: Generating PDFs...          │
│ Processed: 150/250 records          │
│                                     │
│ [View Progress Details]             │
└─────────────────────────────────────┘
```

## 📊 Data Structure Requirements

### Health Insurance (Existing)
```
File: Extracted_Arrears_Data.xlsx
Required Columns:
- POL_NO (Policy Number)
- POLICY_HOLDER (Customer Name)
- TrueArrears (Outstanding Amount)
- PH_EMAIL (Email Address)
- Recovery_action (L0, L1, L2, MED)
- Address fields (POL_PH_ADDR1, POL_PH_ADDR2, etc.)
```

### Non-Motors Insurance (To Be Defined)
```
File: NonMotor_Arrears.xls
Required Columns: [To be determined based on actual file structure]
Expected similar structure:
- Policy Number
- Policy Holder Name
- Outstanding Amount
- Email Address
- Recovery Level
- Address Information
```

## 🔍 Validation & Error Handling

### File Validation
```javascript
const validateFile = (file, productType) => {
  const expectedFiles = {
    health: 'Extracted_Arrears_Data.xlsx',
    nonmotor: 'NonMotor_Arrears.xls'
  };
  
  const expectedExtensions = {
    health: '.xlsx',
    nonmotor: '.xls'
  };
  
  // Validate file name and extension
  // Return validation result
};
```

### Processing Validation
```python
# In NonMotor_L0.py
def validate_nonmotor_data(df):
    """Validate Non-Motor Excel data structure"""
    required_columns = [
        'Policy_Number',  # To be confirmed
        'Policy_Holder',  # To be confirmed
        'Outstanding_Amount',  # To be confirmed
        # ... other required columns
    ]
    
    # Validation logic
    return validation_result
```

## 🚀 Implementation Timeline

### Phase 1: Backend Foundation (Week 1)
- [ ] Create `NonMotor_L0.py` script
- [ ] Create `merge_nonmotor_pdfs.py` script
- [ ] Create output folder structure
- [ ] Test with sample NonMotor_Arrears.xls file

### Phase 2: API Enhancement (Week 2)
- [ ] Modify `routes/arrears.js` for product type support
- [ ] Add product type validation middleware
- [ ] Implement product-specific routing logic
- [ ] Test API endpoints with both product types

### Phase 3: Frontend Integration (Week 3)
- [ ] Add product type selector to dashboard
- [ ] Implement confirmation dialog
- [ ] Update API calls with product type parameter
- [ ] Add dynamic UI labels and validation

### Phase 4: Testing & Polish (Week 4)
- [ ] End-to-end testing for both product types
- [ ] Error handling and edge cases
- [ ] UI/UX improvements
- [ ] Documentation updates

## ✅ Success Criteria

### Functional Requirements
- [ ] Users can select between Health and Non-Motors
- [ ] Correct file processing based on product selection
- [ ] Same UI experience for both product types
- [ ] Proper file organization and downloads
- [ ] Email functionality works for both types
- [ ] No breaking changes to existing Health functionality

### Technical Requirements
- [ ] Clean separation of product-specific logic
- [ ] Maintainable and scalable architecture
- [ ] Proper error handling and validation
- [ ] Consistent API design patterns
- [ ] Performance equivalent to current system

### User Experience Requirements
- [ ] Intuitive product type selection
- [ ] Clear confirmation dialogs
- [ ] Consistent progress tracking
- [ ] Appropriate error messages
- [ ] Seamless workflow transition

## 🔧 Configuration Management

### Environment Variables
```bash
# No new environment variables required
# Existing configuration will be used
```

### Product Configuration
```javascript
// Centralized configuration for easy maintenance
const PRODUCT_TYPES = {
  health: {
    displayName: "Health Insurance",
    inputFile: "Extracted_Arrears_Data.xlsx",
    fileExtension: ".xlsx",
    generator: "L0.py",
    merger: "arrears_merger.py",
    outputPrefix: "",
    color: "#059669", // Green theme
    icon: "heart"
  },
  nonmotor: {
    displayName: "Non-Motors Insurance",
    inputFile: "NonMotor_Arrears.xls",
    fileExtension: ".xls",
    generator: "NonMotor_L0.py",
    merger: "merge_nonmotor_pdfs.py",
    outputPrefix: "NonMotor_",
    color: "#dc2626", // Red theme
    icon: "shield"
  }
};
```

## 📝 Testing Strategy

### Unit Testing
- [ ] Test NonMotor_L0.py with sample data
- [ ] Test merge_nonmotor_pdfs.py functionality
- [ ] Test API endpoints with both product types
- [ ] Test frontend component behavior

### Integration Testing
- [ ] End-to-end workflow for Health Insurance
- [ ] End-to-end workflow for Non-Motors Insurance
- [ ] File upload and validation
- [ ] PDF generation and merging
- [ ] Download functionality

### User Acceptance Testing
- [ ] Collections team tests Health workflow
- [ ] Collections team tests Non-Motors workflow
- [ ] Confirmation dialog usability
- [ ] Error handling scenarios

## 📚 Documentation Updates

### Files to Update
- [ ] `README.md` - Add Non-Motors support information
- [ ] `PROJECT_SPECIFICATION.md` - Update technical specifications
- [ ] API documentation - Add new endpoints
- [ ] User manual - Add product selection guide

### New Documentation
- [ ] `NonMotor_Processing_Guide.md` - Non-Motors specific instructions
- [ ] `Product_Type_Configuration.md` - Configuration management guide

## 🎯 Future Enhancements

### Phase 2 Features (Future)
- [ ] Support for L1, L2, MED levels in Non-Motors
- [ ] Batch processing for mixed product types
- [ ] Advanced reporting and analytics
- [ ] Product-specific email templates

### Scalability Considerations
- [ ] Support for additional product types
- [ ] Dynamic product configuration
- [ ] Multi-tenant support
- [ ] Advanced workflow management

---

**Document Version**: 1.0  
**Created**: December 24, 2025  
**Author**: Development Team  
**Status**: Planning Phase  
**Next Review**: Implementation Start