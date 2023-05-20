import crypto from 'crypto'
function decryptData(encryptedData, nonce, authTag, password) {
    const pass = String((password));
    const key = crypto.createHash('sha256').update(pass).digest();

    const decipher = crypto.createDecipheriv('aes-256-ccm', key, Buffer.from(nonce, 'hex'), { authTagLength: 16 });

    // Set the authentication tag
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData, 'hex')), decipher.final()]);

    return decrypted.toString('utf8');
}

const privateKey = decryptData(
    '0945b992ffe19507e5df146d3c03f20b1e9c02999dd3a23d28123e5e1081f0e28defddc8c91ca0f6eaaedf5d97b8cc758ca49cb116a4d049223d632e32048aee',
    '2008426c70b2db5db3ec5658', 'df734240964cbd66ba4172ab028a7b3c', 'fkgrgta');

console.log({ privateKey });