import Foundation
import Security

guard CommandLine.arguments.count == 2 || CommandLine.arguments.count == 4 else {
    fputs("계정과 선택적인 키체인 항목 이름이 필요합니다.\n", stderr)
    exit(1)
}

let account = CommandLine.arguments[1]
let password = FileHandle.standardInput.readDataToEndOfFile()
guard !password.isEmpty else {
    fputs("비밀번호가 비어 있습니다.\n", stderr)
    exit(1)
}

let service = CommandLine.arguments.count == 4 ? CommandLine.arguments[2] : "gawon-portfolio-community-smtp"
let label = CommandLine.arguments.count == 4 ? CommandLine.arguments[3] : "포트폴리오 피드 네이버 SMTP"
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
]
var item = query
item[kSecAttrLabel as String] = label
item[kSecValueData as String] = password

var result = SecItemAdd(item as CFDictionary, nil)
if result == errSecDuplicateItem {
    result = SecItemUpdate(query as CFDictionary, [
        kSecAttrLabel as String: label,
        kSecValueData as String: password,
    ] as CFDictionary)
}
guard result == errSecSuccess else {
    fputs("키체인 저장에 실패했습니다 (\(result)).\n", stderr)
    exit(1)
}

var lookup = query
lookup[kSecReturnData as String] = true
lookup[kSecMatchLimit as String] = kSecMatchLimitOne
var saved: CFTypeRef?
result = SecItemCopyMatching(lookup as CFDictionary, &saved)
guard result == errSecSuccess, let saved = saved as? Data, saved == password else {
    fputs("키체인 저장값 확인에 실패했습니다.\n", stderr)
    exit(1)
}

print("Mac 키체인에 비밀번호를 저장하고 확인했습니다.")
