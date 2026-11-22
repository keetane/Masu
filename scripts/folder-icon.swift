import AppKit
import Foundation
let args = CommandLine.arguments
guard args.count == 3, let image = NSImage(contentsOfFile: args[1]) else {
    fputs("Usage: folder-icon icon.icns folder\n", stderr); exit(1)
}
let folder = URL(fileURLWithPath: args[2]).standardizedFileURL
guard NSWorkspace.shared.setIcon(image, forFile: folder.path, options: []) else {
    fputs("Finder custom icon could not be verified: \(folder.path)\n", stderr); exit(1)
}


let iconFile = folder.appendingPathComponent("Icon\r")
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/bin/xattr")
process.arguments = ["-px", "com.apple.ResourceFork", iconFile.path]
let pipe = Pipe()
process.standardOutput = pipe
try process.run()
let fork = pipe.fileHandleForReading.readDataToEndOfFile()
process.waitUntilExit()
guard process.terminationStatus == 0, !fork.isEmpty else {
    fputs("Custom icon resource was not saved.\n", stderr)
    exit(1)
}
print("Finder custom icon resource verified for " + folder.path)
