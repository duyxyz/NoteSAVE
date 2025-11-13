# NoteSAVE - Versatile Note-Taking Chrome Extension

NoteSAVE is a simple yet powerful Chrome extension that helps you easily save important text snippets or images from any webpage. You can quickly create new notes, edit, manage, and export/import your saved notes.

## Key Features

* **Save Text Notes:**
    * Highlight any text on a webpage, then right-click and select "Save Note (Text)". The note will be automatically added to your list with a timestamp.
    * Create new text notes directly from the extension's popup.
* **Save Image Notes:**
    * Right-click on any image on a webpage and select "Save Note (Image)". The image will be saved as a note along with the timestamp.
* **Intuitive Note Management:**
    * User-friendly popup interface, allowing easy switching between "Text" and "Image" tabs.
    * Displays a list of notes with their saved times.
* **Quick Actions:**
    * **Multi-Select Notes:** Left-click to select (highlight) multiple notes at once.
    * **Context Menu:** Right-click on a selected note to display a menu with options:
        * **Copy:** Copy the content of a text note (or all selected text notes).
        * **Edit (Text):** Edit text note content directly within the popup.
        * **Save Image (for Image Notes):** Download the saved image to your computer.
        * **Delete:** Delete the selected note (or all selected notes).
* **Export/Import Data:**
    * **Export JSON:** Save all your notes as a JSON file for backup.
    * **Import JSON:** Restore notes from a saved JSON file. You can choose to "Add" them to existing notes or "Replace" the current notes.
* **Multi-language Support:** The extension supports multiple languages (currently: English, Vietnamese).

## Installation Guide

To install NoteSAVE in your Chrome browser, follow these steps:

1.  **Download the Source Code:**
    * Download the entire source code of this extension from the repository where you obtained these files.
    * Extract the ZIP file (if applicable) to an easily accessible folder on your computer (e.g., `NoteSAVE_Extension`).

2.  **Open Chrome Extensions:**
    * Open your Chrome browser.
    * In the address bar, type `chrome://extensions` and press Enter.

3.  **Enable Developer Mode:**
    * In the top-right corner of the Extensions page, find and toggle on "Developer mode."

4.  **Load Unpacked Extension:**
    * After enabling Developer mode, a "Load unpacked" button will appear. Click on this button.
    * The browser will open a folder selection window. Navigate to the `NoteSAVE_Extension` folder that you extracted in Step 1 and select it.

5.  **Complete:**
    * The NoteSAVE extension should now appear in your list of extensions.
    * You can pin the extension to your Chrome toolbar for quick access.

## How to Use

1.  **Open the Extension:** Click on the NoteSAVE icon in your Chrome toolbar to open the popup.
2.  **Save Text:**
    * On any webpage, select the text you wish to save.
    * Right-click on the selection and choose `Save Note (Text)`.
3.  **Save Image:**
    * On any webpage, right-click on the image you wish to save.
    * Choose `Save Note (Image)`.
4.  **Create New Note:**
    * In the extension's popup, click the `Create Note` button.
    * Enter your content and click `Save`.
5.  **Manage Notes:**
    * Use the `Text` and `Image` tabs to view different note types.
    * Left-click on a note to select/deselect it. You can select multiple notes.
    * Right-click on a selected note to copy, edit (text), save image (for image notes), or delete.
6.  **Export/Import:**
    * Use the `Export JSON` button to download all your notes.
    * Use the `Import JSON` button to upload a JSON file and restore or add notes.

## Troubleshooting

* If the extension is not working, try reloading the `chrome://extensions` page or toggling the extension off and on.
* If notes are not being saved, check if you have granted full permissions to the extension in `chrome://extensions`.

---

**Note:** Your notes data is stored locally in your browser and is not sent anywhere.
