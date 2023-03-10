/**
 * The MIT License (MIT)
 * Copyright (c) 2023 otc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * */
import { Appendix, AbstractAppendix } from "./appendix"
import { TransactionType, ORDINARY_PAYMENT_TRANSACTION_TYPE, ARBITRARY_MESSAGE_TRANSACTION_TYPE, COLORED_COINS_ASSET_ISSUANCE_TRANSACTION_TYPE, COLORED_COINS_ASSET_ISSUE_MORE_TRANSACTION_TYPE, COLORED_COINS_ASSET_TRANSFER_TRANSACTION_TYPE, COLORED_COINS_ATOMIC_MULTI_TRANSFER_TRANSACTION_TYPE, COLORED_COINS_ASK_ORDER_PLACEMENT_TRANSACTION_TYPE, COLORED_COINS_BID_ORDER_PLACEMENT_TRANSACTION_TYPE, ASK_ORDER_CANCELLATION_TRANSACTION_TYPE, BID_ORDER_CANCELLATION_TRANSACTION_TYPE, WHITELIST_ACCOUNT_ADDITION_TRANSACTION_TYPE, WHITELIST_ACCOUNT_REMOVAL_TRANSACTION_TYPE, WHITELIST_MARKET_TRANSACTION_TYPE, EFFECTIVE_BALANCE_LEASING_TRANSACTION_TYPE } from "./transaction-type"
import { stringToByteArray, byteArrayToString, hexStringToByteArray, byteArrayToHexString } from "./converters"
import { readBytes, writeBytes } from "./utils"
import { Fee } from "./fee"
import Long from "long"
import ByteBuffer from "bytebuffer"

export interface Attachment extends Appendix {
  getTransactionType(): TransactionType
}

export abstract class EmptyAttachment extends AbstractAppendix implements Attachment {
  constructor() {
    super()
    this.version = 0
  }

  public parse(buffer: ByteBuffer) {
    return this
  }

  public getSize(): number {
    return this.getMySize()
  }

  putMyBytes(buffer: ByteBuffer) { }

  putMyJSON(json: { [key: string]: any }) { }

  getMySize() {
    return 0
  }

  abstract getTransactionType(): TransactionType
  abstract getFee(): string
}

export class Payment extends EmptyAttachment {
  getFee() {
    return Fee.DEFAULT
  }
  getAppendixName() {
    return "OrdinaryPayment"
  }
  getTransactionType() {
    return ORDINARY_PAYMENT_TRANSACTION_TYPE
  }
}

export class Message extends EmptyAttachment {
  getFee() {
    return Fee.DEFAULT
  }
  getAppendixName() {
    return "ArbitraryMessage"
  }
  getTransactionType() {
    return ARBITRARY_MESSAGE_TRANSACTION_TYPE
  }
}

// ------------------- Asset ------------------------------------------------------------------------------------------

export class AssetIssuance extends AbstractAppendix implements Attachment {
  private descriptionUrl: string | undefined
  private descriptionHash: number[] | undefined
  private quantity: Long | undefined
  private decimals: number | undefined
  private dillutable: boolean | undefined

  init(
    descriptionUrl: string,
    descriptionHash: number[] | null,
    quantity: string,
    decimals: number,
    dillutable: boolean
  ) {
    this.descriptionUrl = descriptionUrl
    this.descriptionHash = descriptionHash == null ? new Array(32).fill(0) : descriptionHash
    this.quantity = Long.fromString(quantity)
    this.decimals = decimals
    this.dillutable = dillutable
    return this
  }

  getMySize(): number {
    return 1 + stringToByteArray(this.descriptionUrl!).length + 32 + 8 + 1 + 1
  }

  public parse(buffer: ByteBuffer) {
    super.parse(buffer)
    this.descriptionUrl = byteArrayToString(readBytes(buffer, buffer.readByte())) //need to check Constants.MAX_ASSET_DESCRIPTION_URL_LENGTH ?
    this.descriptionHash = readBytes(buffer, 32)
    this.quantity = buffer.readInt64()
    this.decimals = buffer.readByte()
    this.dillutable = buffer.readByte() == 1
    return this
  }

  putMyBytes(buffer: ByteBuffer): void {
    let descriptionUrl = stringToByteArray(this.descriptionUrl!)
    buffer.writeByte(descriptionUrl.length)
    writeBytes(buffer, descriptionUrl)
    if (this.descriptionHash && this.descriptionHash.length != 32)
      throw new Error("Description hash length must be 32")
    writeBytes(buffer, this.descriptionHash!)
    buffer.writeInt64(this.quantity!)
    buffer.writeByte(this.decimals!)
    buffer.writeByte(this.dillutable ? 1 : 0)
  }

  public parseJSON(json: { [key: string]: any }) {
    super.parseJSON(json)
    this.descriptionUrl = json["descriptionUrl"]
    this.descriptionHash = hexStringToByteArray(json["descriptionHash"])
    this.quantity = Long.fromString(json["quantity"])
    this.decimals = json["decimals"]
    this.dillutable = json["dillutable"]
    return this
  }

  putMyJSON(json: { [key: string]: any }): void {
    json["descriptionUrl"] = this.descriptionUrl
    json["descriptionHash"] = byteArrayToHexString(Array.from(this.descriptionHash!))
    json["quantity"] = this.quantity!.toString()
    json["decimals"] = this.decimals
    json["dillutable"] = this.dillutable
  }

  getFee() {
    return Fee.ASSET_ISSUANCE_FEE
  }

  getAppendixName() {
    return "AssetIssuance"
  }

  getTransactionType() {
    return COLORED_COINS_ASSET_ISSUANCE_TRANSACTION_TYPE
  }

  getDescriptionUrl(): string {
    return this.descriptionUrl!
  }

  getDescriptionHash(): number[] {
    return this.descriptionHash!
  }

  getQuantity(): Long {
    return this.quantity!
  }

  getDecimals(): number {
    return this.decimals!
  }

  getDillutable(): boolean {
    return this.dillutable!
  }
}

export abstract class AssetBase extends AbstractAppendix {
  private assetId: Long | undefined
  private quantity: Long | undefined

  init(assetId: string, quantity: string) {
    this.assetId = Long.fromString(assetId)
    this.quantity = Long.fromString(quantity)
    return this
  }

  getMySize(): number {
    return 8 + 8
  }

  public parse(buffer: ByteBuffer) {
    super.parse(buffer)
    this.assetId = buffer.readInt64()
    this.quantity = buffer.readInt64()
    return this
  }

  putMyBytes(buffer: ByteBuffer): void {
    buffer.writeInt64(this.assetId!)
    buffer.writeInt64(this.quantity!)
  }

  putMyJSON(json: { [key: string]: any }): void {
    json["asset"] = this.assetId!.toUnsigned().toString()
    json["quantity"] = this.quantity!.toString()
  }

  parseJSON(json: { [key: string]: any }) {
    super.parseJSON(json)
    this.assetId = Long.fromString(json["asset"], true)
    this.quantity = Long.fromString(json["quantity"])
    return this
  }

  getAssetId(): Long {
    return this.assetId!
  }

  getQuantity(): Long {
    return this.quantity!
  }
}

export class AssetIssueMore extends AssetBase implements Attachment {
  getFee() {
    return Fee.ASSET_ISSUE_MORE_FEE
  }

  getAppendixName() {
    return "AssetIssueMore"
  }

  getTransactionType() {
    return COLORED_COINS_ASSET_ISSUE_MORE_TRANSACTION_TYPE
  }
}

export class AssetTransfer extends AssetBase implements Attachment {
  getFee() {
    return Fee.ASSET_TRANSFER_FEE
  }

  getAppendixName() {
    return "AssetTransfer"
  }

  getTransactionType() {
    return COLORED_COINS_ASSET_TRANSFER_TRANSACTION_TYPE
  }
}

export type AtomicTransfer = {
  recipient: string
  assetId: string
  quantity: string
}

export class AtomicMultiTransfer extends AbstractAppendix implements Attachment {
  private transfers: AtomicTransfer[] | undefined

  init(transfers: AtomicTransfer[]) {
    this.transfers = transfers
    return this
  }

  get getTransfers(): AtomicTransfer[] {
    return this.transfers!
  }

  getFee() {
    return Fee.ATOMIC_MULTI_TRANSFER_FEE
  }

  getAppendixName() {
    return "AtomicMultiTransfer"
  }

  getTransactionType() {
    return COLORED_COINS_ATOMIC_MULTI_TRANSFER_TRANSACTION_TYPE
  }

  getMySize(): number {
    return 1 + this.transfers!.length * (8 + 8 + 8)
  }

  putMyBytes(buffer: ByteBuffer): void {
    buffer.writeByte(this.transfers!.length)
    this.transfers!.forEach(function (transfer) {
      buffer.writeInt64(Long.fromString(transfer.recipient, true))
      buffer.writeInt64(Long.fromString(transfer.assetId, true))
      buffer.writeInt64(Long.fromString(transfer.quantity))
    })
  }

  public parse(buffer: ByteBuffer) {
    super.parse(buffer)
    let count = buffer.readByte()
    this.transfers = []
    for (let i = 0; i < count; i++) {
      let v: AtomicTransfer = {
        recipient: buffer
          .readInt64()
          .toUnsigned()
          .toString(),
        assetId: buffer
          .readInt64()
          .toUnsigned()
          .toString(),
        quantity: buffer.readInt64().toString()
      }
      this.transfers.push(v)
    }
    return this
  }

  putMyJSON(json: { [key: string]: any }): void {
    let ts = <Array<any>>[]
    this.transfers!.forEach(function (transfer) {
      ts.push({
        recipient: transfer.recipient,
        assetId: transfer.assetId,
        quantity: transfer.quantity
      })
    })
    json["transfers"] = ts
  }

  parseJSON(json: { [key: string]: any }) {
    this.transfers = []
    let ts = json["transfers"]
    for (let i in ts) {
      this.transfers.push({
        recipient: ts[i].recipient,
        assetId: ts[i].assetId,
        quantity: ts[i].quantity
      })
    }
    return this
  }
}

// ------------------- Colored coins. Orders ----------------------------------------------------------------------------

export abstract class ColoredCoinsOrderPlacement extends AbstractAppendix {
  private currencyId: Long | undefined
  private assetId: Long | undefined
  private quantity: Long | undefined
  private price: Long | undefined
  private expiration: number | undefined

  init(currencyId: string, assetId: string, quantity: string, price: string, expiration: number) {
    this.currencyId = Long.fromString(currencyId)
    this.assetId = Long.fromString(assetId)
    this.quantity = Long.fromString(quantity)
    this.price = Long.fromString(price)
    this.expiration = expiration
    return this
  }

  getMySize(): number {
    return 8 + 8 + 8 + 8 + 4
  }

  putMyBytes(buffer: ByteBuffer): void {
    buffer.writeInt64(this.currencyId!)
    buffer.writeInt64(this.assetId!)
    buffer.writeInt64(this.quantity!)
    buffer.writeInt64(this.price!)
    buffer.writeInt32(this.expiration!)
  }

  public parse(buffer: ByteBuffer) {
    super.parse(buffer)
    this.currencyId = buffer.readInt64()
    this.assetId = buffer.readInt64()
    this.quantity = buffer.readInt64()
    this.price = buffer.readInt64()
    this.expiration = buffer.readInt32()
    return this
  }

  putMyJSON(json: { [key: string]: any }): void {
    json["currency"] = this.currencyId!.toUnsigned().toString()
    json["asset"] = this.assetId!.toUnsigned().toString()
    json["quantity"] = this.quantity!.toString()
    json["price"] = this.price!.toString()
    json["expiration"] = this.expiration!.toString()
  }

  parseJSON(json: { [key: string]: any }) {
    super.parseJSON(json)
    this.currencyId = Long.fromString(json["currency"], true)
    this.assetId = Long.fromString(json["asset"], true)
    this.quantity = Long.fromString(json["quantity"])
    this.price = Long.fromString(json["price"])
    this.expiration = json["expiration"]
    return this
  }

  getFee() {
    return Fee.ORDER_PLACEMENT_FEE
  }

  getCurrencyId(): Long {
    return this.currencyId!
  }

  getAssetId(): Long {
    return this.assetId!
  }

  getQuantity(): Long {
    return this.quantity!
  }

  getPrice(): Long {
    return this.price!
  }

  getExpiration(): number {
    return this.expiration!
  }
}

export class ColoredCoinsAskOrderPlacement extends ColoredCoinsOrderPlacement
  implements Attachment {
  getAppendixName() {
    return "AskOrderPlacement"
  }

  getTransactionType() {
    return COLORED_COINS_ASK_ORDER_PLACEMENT_TRANSACTION_TYPE
  }
}

export class ColoredCoinsBidOrderPlacement extends ColoredCoinsOrderPlacement
  implements Attachment {
  getAppendixName() {
    return "BidOrderPlacement"
  }

  getTransactionType() {
    return COLORED_COINS_BID_ORDER_PLACEMENT_TRANSACTION_TYPE
  }
}

export abstract class ColoredCoinsOrderCancellation extends AbstractAppendix {
  private orderId: Long | undefined

  init(orderId: string) {
    this.orderId = Long.fromString(orderId)
    return this
  }

  getMySize(): number {
    return 8
  }

  public parse(buffer: ByteBuffer) {
    super.parse(buffer)
    this.orderId = buffer.readInt64()
    return this
  }

  putMyBytes(buffer: ByteBuffer): void {
    buffer.writeInt64(this.orderId!)
  }

  parseJSON(json: { [key: string]: any }) {
    super.parseJSON(json)
    this.orderId = Long.fromString(json["order"], true)
    return this
  }

  putMyJSON(json: { [key: string]: any }): void {
    json["order"] = this.orderId!.toUnsigned().toString()
  }

  getFee() {
    return Fee.ORDER_CANCELLATION_FEE
  }

  getOrderId(): Long {
    return this.orderId!
  }
}

export class ColoredCoinsAskOrderCancellation extends ColoredCoinsOrderCancellation
  implements Attachment {
  getAppendixName() {
    return "AskOrderCancellation"
  }

  getTransactionType() {
    return ASK_ORDER_CANCELLATION_TRANSACTION_TYPE
  }
}

export class ColoredCoinsBidOrderCancellation extends ColoredCoinsOrderCancellation
  implements Attachment {
  getAppendixName() {
    return "BidOrderCancellation"
  }

  getTransactionType() {
    return BID_ORDER_CANCELLATION_TRANSACTION_TYPE
  }
}

// ------------------- Colored coins. Whitelist ------------------------------------------------------------------------

export class ColoredCoinsWhitelistAccountAddition extends AbstractAppendix
  implements Attachment {
  private assetId: Long | undefined
  private accountId: Long | undefined
  private endHeight: number | undefined

  init(assetId: string, accountId: string, endHeight: number) {
    this.assetId = Long.fromString(assetId)
    this.accountId = Long.fromString(accountId)
    this.endHeight = endHeight
    return this
  }

  getMySize(): number {
    return 8 + 8 + 4
  }

  public parse(buffer: ByteBuffer) {
    super.parse(buffer)
    this.assetId = buffer.readInt64()
    this.accountId = buffer.readInt64()
    this.endHeight = buffer.readInt32()
    return this
  }

  putMyBytes(buffer: ByteBuffer): void {
    buffer.writeInt64(this.assetId!)
    buffer.writeInt64(this.accountId!)
    buffer.writeInt32(this.endHeight!)
  }

  parseJSON(json: { [key: string]: any }) {
    super.parseJSON(json)
    this.assetId = Long.fromString(json["asset"], true)
    this.accountId = Long.fromString(json["account"], true)
    this.endHeight = json["endHeight"]
    return this
  }

  putMyJSON(json: { [key: string]: any }): void {
    json["asset"] = this.assetId!.toUnsigned().toString()
    json["account"] = this.accountId!.toUnsigned().toString()
    json["endHeight"] = this.endHeight
  }

  getAppendixName() {
    return "WhitelistAccountAddition"
  }

  getTransactionType() {
    return WHITELIST_ACCOUNT_ADDITION_TRANSACTION_TYPE
  }

  getFee() {
    return Fee.WHITELIST_ACCOUNT_FEE
  }

  getAssetId(): Long {
    return this.assetId!
  }

  getAccountId(): Long {
    return this.accountId!
  }

  getEndHeight(): number {
    return this.endHeight!
  }
}

export class ColoredCoinsWhitelistAccountRemoval extends AbstractAppendix
  implements Attachment {
  private assetId: Long | undefined
  private accountId: Long | undefined

  init(assetId: string, accountId: string) {
    this.assetId = Long.fromString(assetId)
    this.accountId = Long.fromString(accountId)
    return this
  }

  getMySize(): number {
    return 8 + 8
  }

  public parse(buffer: ByteBuffer) {
    super.parse(buffer)
    this.assetId = buffer.readInt64()
    this.accountId = buffer.readInt64()
    return this
  }

  putMyBytes(buffer: ByteBuffer): void {
    buffer.writeInt64(this.assetId!)
    buffer.writeInt64(this.accountId!)
  }

  parseJSON(json: { [key: string]: any }) {
    super.parseJSON(json)
    this.assetId = Long.fromString(json["asset"], true)
    this.accountId = Long.fromString(json["account"], true)
    return this
  }

  putMyJSON(json: { [key: string]: any }): void {
    json["asset"] = this.assetId!.toUnsigned().toString()
    json["account"] = this.accountId!.toUnsigned().toString()
  }

  getAppendixName() {
    return "WhitelistAccountRemoval"
  }

  getTransactionType() {
    return WHITELIST_ACCOUNT_REMOVAL_TRANSACTION_TYPE
  }

  getFee() {
    return Fee.WHITELIST_ACCOUNT_FEE
  }

  getAssetId(): Long {
    return this.assetId!
  }

  getAccountId(): Long {
    return this.accountId!
  }
}

export class ColoredCoinsWhitelistMarket extends AbstractAppendix implements Attachment {
  private currencyId: Long | undefined
  private assetId: Long | undefined

  init(currencyId: string, assetId: string) {
    this.currencyId = Long.fromString(currencyId)
    this.assetId = Long.fromString(assetId)
    return this
  }

  getMySize(): number {
    return 8 + 8
  }

  public parse(buffer: ByteBuffer) {
    super.parse(buffer)
    this.currencyId = buffer.readInt64()
    this.assetId = buffer.readInt64()
    return this
  }

  putMyBytes(buffer: ByteBuffer): void {
    buffer.writeInt64(this.currencyId!)
    buffer.writeInt64(this.assetId!)
  }

  parseJSON(json: { [key: string]: any }) {
    super.parseJSON(json)
    this.currencyId = Long.fromString(json["currency"], true)
    this.assetId = Long.fromString(json["asset"], true)
    return this
  }

  putMyJSON(json: { [key: string]: any }): void {
    json["currency"] = this.currencyId!.toUnsigned().toString()
    json["asset"] = this.assetId!.toUnsigned().toString()
  }

  getAppendixName() {
    return "WhitelistMarket"
  }

  getTransactionType() {
    return WHITELIST_MARKET_TRANSACTION_TYPE
  }

  getFee() {
    return Fee.WHITELIST_MARKET_FEE
  }

  getAssetId(): Long {
    return this.assetId!
  }

  getCurrencyId(): Long {
    return this.currencyId!
  }
}

// ------------------- AccountControlEffectiveBalanceLeasing -----------------------------------------------------------

export class AccountControlEffectiveBalanceLeasing extends AbstractAppendix
  implements Attachment {
  private period: number | undefined

  init(period: number) {
    this.period = period
    return this
  }

  getMySize(): number {
    return 4
  }

  public parse(buffer: ByteBuffer) {
    super.parse(buffer)
    this.period = buffer.readInt32()
    return this
  }

  putMyBytes(buffer: ByteBuffer): void {
    buffer.writeInt32(this.period!)
  }

  parseJSON(json: { [key: string]: any }) {
    super.parseJSON(json)
    this.period = json["period"]
    return this
  }

  putMyJSON(json: { [key: string]: any }): void {
    json["period"] = this.period
  }

  getAppendixName() {
    return "EffectiveBalanceLeasing"
  }

  getTransactionType() {
    return EFFECTIVE_BALANCE_LEASING_TRANSACTION_TYPE
  }

  getFee() {
    return Fee.EFFECTIVE_BALANCE_LEASING_FEE
  }

  getPeriod(): number {
    return this.period!
  }
}

export const ORDINARY_PAYMENT = new Payment()
export const ARBITRARY_MESSAGE = new Message()
