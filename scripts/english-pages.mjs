export function englishPages(license, notices) {
  return {
    about: [
      "Help & support",
      "Masu is a free web application for practicing written addition, subtraction, multiplication and division. No account is required.",
      "Choose an operation, difficulty and number of questions, then select Start practice. Enter a digit at the highlighted position. With Auto ON, the next position is selected automatically. Once all positions are filled, select Grade. The same button becomes Next question, or See results on the final question. You can continue with incorrect answers and review marked questions later.",
      "To report a bug with a screenshot, choose Report in the top menu. Review the screenshot and description, select Report on GitHub and attach the image manually on GitHub. Signing in is required; reports and attachments are public.",
      "Individuals, families, schools and tutoring services may use Masu free of charge. See Terms and Licenses for the conditions of use and third-party software notices.",
      "Operated by keetane, the owner of the public repository. Contact us and report bugs through GitHub Issues. You must sign in to GitHub. Reports and attachments are public; do not include personal information or learning records.",
    ],
    privacy: [
      "Privacy & external communication",
      "Settings, unfinished answers, and the most recent 30 sessions (up to 100 questions) are stored in this browser on this device using localStorage. Your language choice is also stored in this browser. No name, email address or account registration is required. Delete learning records from Settings. Records are separate for each device, browser and site address; they are not synchronized.",
      "There is no feature that automatically sends learning records to a server, and no advertising, analytics, external fonts or external images are loaded. The application itself does not use advertising or analytics cookies.",
      "The web host, such as GitHub Pages, may process connection information including your IP address and browser when you request pages. Please also consult the hosting provider's privacy policy. The macOS version serves pages from your Mac. When devices on the same Wi-Fi connect to it, learning records remain in each device's browser.",
      "For bug reports, review the screenshot you choose, your description and the information shown in the report. Including the question and input position is optional. You can also exclude browser, screen size and language information. Images and drafts are not automatically sent or saved; your full learning history is never included. Opening the GitHub report page passes the report text to GitHub in the URL unless it is too long. Attach the image manually on GitHub. Reports and attachments are public, and attachments are uploaded even before you confirm posting. A GitHub account is required to sign in. Optional sharing passes the image and report to an app you choose. Review the content before handing it over.",
      "If advertising or analytics is introduced, information about recipients, data, purposes and any necessary choices will be provided again. This version does not load advertising or analytics scripts.",
    ],
    terms: [
      "Terms of use",
      "Masu is free to use for learning and teaching written arithmetic by individuals, families, schools and tutoring services. You may also use it as a learning tool in paid lessons. Users are responsible for connection and device costs.",
      "Masu's original components are covered by the Masu Free Use License 1.0. It is not an open-source license that generally permits redistribution of modified source code or materials, or their sale. Read the full license on the Licenses page. Third-party software is governed by its respective licenses. English policy and license text is provided as a translation for convenience; the Japanese original governs.",
      "Learning records are stored in your browser and can be lost when site data is deleted. Accuracy of calculations and marking, continued availability and data retention are not guaranteed. Liability is limited to the extent permitted by applicable law. This does not exclude liability for intentional misconduct, gross negligence or other liability that cannot be excluded by law.",
    ],
    licenses: [
      "Licenses & free use",
      "Masu is free to use. The conditions for original components and the permissions for third-party software are reproduced below. The board and icons use geometric shapes created for this project; icons from the earlier apps are not reused. Fonts come from your device; no font files are distributed.",
      license,
      notices,
    ],
  };
}
