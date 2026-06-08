/**
 * Stellar LABS Platform Usage Examples
 * 
 * This file demonstrates how to use the Stellar LABS Platform
 * for various identity and credential operations.
 */

const LABSService = require('../src/services/LABSService');

// Initialize the service
const LABSService = new LABSService();

async function example1_createAndResolveLABS() {
    console.log('\n=== Example 1: Create and Resolve LABS ===');
    
    try {
        // Create a new LABS
        console.log('Creating new LABS...');
        const LABSResult = await LABSService.createLABS({
            serviceEndpoint: 'https://example.com/identity-hub'
        });
        
        console.log('LABS created successfully!');
        console.log('LABS:', LABSResult.LABS);
        console.log('Public Key:', LABSResult.account.publicKey);
        
        // Resolve the LABS
        console.log('\nResolving LABS...');
        const resolved = await LABSService.resolveLABS(LABSResult.LABS);
        
        console.log('LABS resolved successfully!');
        console.log('Document:', JSON.stringify(resolved.LABSDocument, null, 2));
        
        return LABSResult;
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example2_issueAndVerifyCredential() {
    console.log('\n=== Example 2: Issue and Verify Verifiable Credential ===');
    
    try {
        // Create issuer and subject LABSs
        console.log('Creating issuer LABS...');
        const issuer = await LABSService.createLABS();
        
        console.log('Creating subject LABS...');
        const subject = await LABSService.createLABS();
        
        // Issue a university degree credential
        console.log('Issuing university degree credential...');
        const credential = await LABSService.createVerifiableCredential(
            issuer.LABS,
            subject.LABS,
            {
                degree: 'Bachelor of Science',
                major: 'Computer Science',
                university: 'Stellar University',
                graduationDate: '2023-06-15',
                gpa: '3.8'
            },
            {
                type: ['UniversityDegreeCredential'],
                expirationDate: '2030-06-15'
            }
        );
        
        console.log('Credential issued!');
        console.log('Credential ID:', credential.id);
        
        // Verify the credential
        console.log('\nVerifying credential...');
        const verification = await LABSService.verifyCredential(credential);
        
        console.log('Verification result:', verification);
        
        return { issuer, subject, credential, verification };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example3_professionalLicense() {
    console.log('\n=== Example 3: Professional License Credential ===');
    
    try {
        // Create medical board and doctor LABSs
        console.log('Creating medical board LABS...');
        const medicalBoard = await LABSService.createLABS({
            serviceEndpoint: 'https://medical-board.example.com/verification'
        });
        
        console.log('Creating doctor LABS...');
        const doctor = await LABSService.createLABS();
        
        // Issue medical license
        console.log('Issuing medical license...');
        const medicalLicense = await LABSService.createVerifiableCredential(
            medicalBoard.LABS,
            doctor.LABS,
            {
                licenseType: 'Medical Doctor',
            licenseNumber: 'MD123456',
            issuingBoard: 'State Medical Board',
            issuedDate: '2020-01-15',
            expirationDate: '2025-01-15',
            status: 'Active',
            specializations: ['Family Medicine', 'Emergency Medicine']
            },
            {
                type: ['ProfessionalLicenseCredential', 'MedicalLicenseCredential']
            }
        );
        
        console.log('Medical license issued!');
        console.log('License details:', JSON.stringify(medicalLicense, null, 2));
        
        // Verify the license
        const verification = await LABSService.verifyCredential(medicalLicense);
        console.log('License verification:', verification);
        
        return { medicalBoard, doctor, medicalLicense, verification };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example4_ageVerification() {
    console.log('\n=== Example 4: Privacy-Preserving Age Verification ===');
    
    try {
        // Create government agency and user LABSs
        console.log('Creating government agency LABS...');
        const government = await LABSService.createLABS();
        
        console.log('Creating user LABS...');
        const user = await LABSService.createLABS();
        
        // Issue age verification credential (without revealing birth date)
        console.log('Issuing age verification credential...');
        const ageCredential = await LABSService.createVerifiableCredential(
            government.LABS,
            user.LABS,
            {
                isOver18: true,
                isOver21: true,
                isOver65: false,
                verificationMethod: 'Government ID Verification',
                verifiedCountry: 'US'
            },
            {
                type: ['AgeVerificationCredential']
            }
        );
        
        console.log('Age verification credential issued!');
        console.log('User can prove they are over 21 without revealing birth date');
        
        // Verify the age credential
        const verification = await LABSService.verifyCredential(ageCredential);
        console.log('Age verification:', verification);
        
        return { government, user, ageCredential, verification };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example5_employmentVerification() {
    console.log('\n=== Example 5: Employment Verification ===');
    
    try {
        // Create company and employee LABSs
        console.log('Creating company LABS...');
        const company = await LABSService.createLABS({
            serviceEndpoint: 'https://hr.company.example.com/verify'
        });
        
        console.log('Creating employee LABS...');
        const employee = await LABSService.createLABS();
        
        // Issue employment verification
        console.log('Issuing employment verification...');
        const employmentCredential = await LABSService.createVerifiableCredential(
            company.LABS,
            employee.LABS,
            {
                employer: 'Tech Company Inc.',
                position: 'Senior Blockchain Developer',
                department: 'Engineering',
                startDate: '2021-03-01',
                currentEmployee: true,
                employmentType: 'Full-time',
                location: 'San Francisco, CA'
            },
            {
                type: ['EmploymentCredential']
            }
        );
        
        console.log('Employment verification issued!');
        
        // Verify employment
        const verification = await LABSService.verifyCredential(employmentCredential);
        console.log('Employment verification:', verification);
        
        return { company, employee, employmentCredential, verification };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example6_batchOperations() {
    console.log('\n=== Example 6: Batch Credential Operations ===');
    
    try {
        // Create university and multiple student LABSs
        console.log('Creating university LABS...');
        const university = await LABSService.createLABS();
        
        console.log('Creating student LABSs...');
        const students = [];
        for (let i = 1; i <= 3; i++) {
            const student = await LABSService.createLABS();
            students.push(student);
        }
        
        // Issue credentials to all students
        console.log('Issuing credentials to all students...');
        const credentials = [];
        
        for (let i = 0; i < students.length; i++) {
            const credential = await LABSService.createVerifiableCredential(
                university.LABS,
                students[i].LABS,
                {
                    studentId: `STU${String(i + 1).padStart(4, '0')}`,
                    degree: 'Bachelor of Science',
                    major: ['Computer Science', 'Data Science', 'Cybersecurity'][i],
                    university: 'Stellar University',
                    graduationDate: '2023-06-15',
                    honors: i === 0 ? 'Cum Laude' : null
                },
                {
                    type: ['UniversityDegreeCredential']
                }
            );
            credentials.push(credential);
        }
        
        console.log(`Issued ${credentials.length} credentials`);
        
        // Verify all credentials
        console.log('Verifying all credentials...');
        const verifications = await Promise.all(
            credentials.map(cred => LABSService.verifyCredential(cred))
        );
        
        const validCount = verifications.filter(v => v.verified).length;
        console.log(`Verified ${validCount}/${credentials.length} credentials successfully`);
        
        return { university, students, credentials, verifications };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example7_LABSAuthentication() {
    console.log('\n=== Example 7: LABS Authentication ===');
    
    try {
        // Create user LABS
        console.log('Creating user LABS...');
        const user = await LABSService.createLABS();
        
        // Create authentication token
        console.log('Creating authentication token...');
        const token = LABSService.createAuthToken(user.LABS, '1h');
        
        console.log('Authentication token created!');
        console.log('Token:', token);
        
        // Verify the token
        console.log('\nVerifying authentication token...');
        const verification = LABSService.verifyAuthToken(token);
        
        console.log('Token verification:', verification);
        
        return { user, token, verification };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run all examples
async function runAllExamples() {
    console.log('🚀 Stellar LABS Platform - Usage Examples');
    console.log('==========================================');
    
    await example1_createAndResolveLABS();
    await example2_issueAndVerifyCredential();
    await example3_professionalLicense();
    await example4_ageVerification();
    await example5_employmentVerification();
    await example6_batchOperations();
    await example7_LABSAuthentication();
    
    console.log('\n✅ All examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
    runAllExamples().catch(console.error);
}

module.exports = {
    example1_createAndResolveLABS,
    example2_issueAndVerifyCredential,
    example3_professionalLicense,
    example4_ageVerification,
    example5_employmentVerification,
    example6_batchOperations,
    example7_LABSAuthentication,
    runAllExamples
};
