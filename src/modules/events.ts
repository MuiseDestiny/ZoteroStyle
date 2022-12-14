import { log } from "zotero-plugin-toolkit/dist/utils";
import AddonItem from "./item";

export default class Events {
	public recordInterval = 5;  // s
	public updateInterval = 60;  // s
	public maxHangTime = 60;  // s
	public state = {
		activate: true,
		pageIndex: -1,
		left: -1,
		top: -1,
		hangCount: -1
	}
	public intervalID: number | undefined;
	private addonItem: AddonItem;
	constructor(addonItem: AddonItem) {
		this.addonItem = addonItem;
	}

	public onInit() {
		window.addEventListener('activate', async () => {
			this.state.activate = true
			// once Zotero is activated again, it will continue to record read time
			this.intervalID = window.setInterval(async () => {
				await this.listeningReader()
			}, this.recordInterval * 1e3)
		}, true);
		window.addEventListener('deactivate', async () => {
			this.state.activate = false
			this.state.hangCount = 0;
			// once Zotero is deactivate again, it will stop to record read time
			window.clearInterval(this.intervalID)
		}, true);
	}

	public async listeningReader() {
		log("listeningReader is running")
		const reader = this.getReader()
		const item = this.getItem()
		// Zotero is bulr
		if (!(reader && reader.state && this.state.activate && item)) { return }

		const pageIndex = reader.state.pageIndex;
		if (pageIndex == this.state.pageIndex) {
			if (reader.state.left == this.state.left && reader.state.top == this.state.top)
				this.state.hangCount++;
			else {
				this.state.left = reader.state.left;
				this.state.top = reader.state.top;
				this.state.hangCount = 0;
			}
		} else {
			this.state.pageIndex = pageIndex;
			this.state.hangCount = 0;
		}
		// hang up
		if (this.state.hangCount * this.recordInterval > this.maxHangTime) return;

		// reading, record this recordInterval
		const page = (reader._iframeWindow as any).wrappedJSObject.PDFViewerApplication.pdfDocument.numPages;

		// get local record
		let record = this.addonItem.get(item, "readingTime")
		if (!record) {
			record = {
				page: page,
				data: {}
			}
		}
		log("record before", record)
		if (record.data[pageIndex]) {
			record.data[pageIndex] += this.recordInterval
		} else {
			record.data[pageIndex] = this.recordInterval
		}
		log("record after", record)
		await this.addonItem.set(item, "readingTime", record)
	}

	public getReader() {
		return Zotero.Reader.getByTabID(Zotero_Tabs.selectedID) as _ZoteroReaderInstance
	}

	public getItem() {
		let reader = this.getReader()
		if (reader) {
			return (Zotero.Items.get(reader.itemID) as _ZoteroItem).parentItem as _ZoteroItem
		}
	}
}