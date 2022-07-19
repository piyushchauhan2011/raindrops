import { ObjectWrapper, Program } from "@raindrop-studios/sol-kit";
import { web3, BN, AnchorProvider, Wallet } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";

import { ITEM_ID } from "../constants/programIds";
import * as ItemInstruction from "../instructions/item";
import { decodeItemClass, ItemClass } from "../state/item";
import { getAtaForMint, getItemPDA } from "../utils/pda";
import { PREFIX } from "../constants/item";

export class ItemProgram extends Program.Program {
  declare instruction: ItemInstruction.Instruction;
  static PREFIX = PREFIX;
  PROGRAM_ID = ITEM_ID;

  constructor() {
    super();
    this.instruction = new ItemInstruction.Instruction({ program: this });
  }

  async fetchItemClass(
    mint: web3.PublicKey,
    index: BN
  ): Promise<ItemClassWrapper | null> {
    let itemClass = (await getItemPDA(mint, index))[0];

    // Need a manual deserializer due to our hack we had to do.
    let itemClassObj = await (
      this.client.provider as AnchorProvider
    ).connection.getAccountInfo(itemClass);

    if (!itemClassObj?.data) {
      return Promise.resolve(null);
    }
    const ic = decodeItemClass(itemClassObj.data);

    return new ItemClassWrapper({
      program: this,
      key: itemClass,
      data: itemClassObj.data,
      object: ic,
    });
  }

  async createItemClass(
    args: ItemInstruction.CreateItemClassArgs,
    accounts: ItemInstruction.CreateItemClassAccounts,
    additionalArgs: ItemInstruction.CreateItemClassAdditionalArgs,
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.createItemClass(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }

  async updateItemClass(
    args: ItemInstruction.UpdateItemClassArgs,
    accounts: ItemInstruction.UpdateItemClassAccounts,
    additionalArgs: ItemInstruction.UpdateItemClassAdditionalArgs,
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.updateItemClass(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }

  async createItemEscrow(
    args: ItemInstruction.CreateItemEscrowArgs,
    accounts: ItemInstruction.CreateItemEscrowAccounts,
    additionalArgs: ItemInstruction.CreateItemEscrowAdditionalArgs,
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.createItemEscrow(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }

  async completeItemEscrowBuildPhase(
    args: ItemInstruction.CompleteItemEscrowBuildPhaseArgs,
    accounts: ItemInstruction.CompleteItemEscrowBuildPhaseAccounts,
    additionalArgs: ItemInstruction.CompleteItemEscrowBuildPhaseAdditionalArgs,
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.completeItemEscrowBuildPhase(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }

  async deactivateItemEscrow(
    args: ItemInstruction.DeactivateItemEscrowArgs,
    accounts: ItemInstruction.DeactivateItemEscrowAccounts,
    additionalArgs: ItemInstruction.DeactivateItemEscrowAdditionalArgs,
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.deactivateItemEscrow(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }

  async updateValidForUseIfWarmupPassed(
    args: ItemInstruction.UpdateValidForUseIfWarmupPassedArgs,
    accounts: ItemInstruction.UpdateValidForUseIfWarmupPassedAccounts = {},
    additionalArgs: ItemInstruction.UpdateValidForUseIfWarmupPassedAdditionalArgs = {},
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.updateValidForUseIfWarmupPassed(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }

  async addCraftItemToEscrow(
    args: ItemInstruction.AddCraftItemToEscrowArgs,
    accounts: Omit<ItemInstruction.AddCraftItemToEscrowAccounts,'craftItemTransferAuthority'>,
    additionalArgs: ItemInstruction.AddCraftItemToEscrowAdditionalArgs,
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const signers = [];
    const craftItemTransferAuthority = web3.Keypair.generate();
    signers.push(craftItemTransferAuthority);

    const instructions = await this.instruction.addCraftItemToEscrow(
      args,
      {
        ...accounts,
        craftItemTransferAuthority: craftItemTransferAuthority.publicKey,
      },
      { additionalArgs }
    );

    return this.sendWithRetry(instructions, signers, options);
  }

  async removeCraftItemFromEscrow(
    args: ItemInstruction.RemoveCraftItemFromEscrowArgs,
    accounts: ItemInstruction.RemoveCraftItemFromEscrowAccounts,
    additionalArgs: ItemInstruction.RemoveCraftItemFromEscrowAdditionalArgs,
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.removeCraftItemFromEscrow(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }

  async beginItemActivation(
    args: Omit<ItemInstruction.BeginItemActivationArgs, "itemClass">,
    accounts: ItemInstruction.BeginItemActivationAccounts,
    additionalArgs: ItemInstruction.BeginItemActivationAdditionalArgs = {},
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const signers = [];
    const itemTransferAuthority =
      accounts.itemTransferAuthority || web3.Keypair.generate();
    if (
      accounts.itemAccount &&
      accounts.itemAccount.equals(
        (
          await getAtaForMint(
            accounts.itemMint,
            (this.client.provider as AnchorProvider).wallet.publicKey
          )
        )[0]
      )
    ) {
      signers.push(itemTransferAuthority);
    }
    const itemClass = await this.fetchItemClass(
      args.itemClassMint,
      args.classIndex
    );
    if (!itemClass) {
      throw new Error(
        "Item class could not be found, please double check the specified itemClassMint and classIndex"
      );
    }

    const instruction = await this.instruction.beginItemActivation(
      { ...args, itemClass },
      { ...accounts, itemTransferAuthority },
      additionalArgs
    );
    return this.sendWithRetry(instruction, signers, options);
  }

  async endItemActivation(
    args: ItemInstruction.EndItemActivationArgs,
    accounts: ItemInstruction.EndItemActivationAccounts,
    additionalArgs: ItemInstruction.EndItemActivationAdditionalArgs = {},
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.endItemActivation(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }

  async drainItemEscrow(
    args: ItemInstruction.DrainItemEscrowArgs,
    accounts: ItemInstruction.DrainItemEscrowAccounts,
    additionalArgs: ItemInstruction.DrainItemEscrowAdditionalArgs = {},
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.drainItemEscrow(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }

  async startItemEscrowBuildPhase(
    args: ItemInstruction.StartItemEscrowBuildPhaseArgs,
    accounts: ItemInstruction.StartItemEscrowBuildPhaseAccounts,
    additionalArgs: ItemInstruction.StartItemEscrowBuildPhaseAdditionalArgs,
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.startItemEscrowBuildPhase(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }

  async updateItem(
    args: ItemInstruction.UpdateItemArgs,
    accounts: ItemInstruction.UpdateItemAccounts,
    additionalArgs: ItemInstruction.UpdateItemAdditionalArgs,
    options?: SendOptions
  ): Promise<{
    txid: string;
    slot: number;
  }> {
    const instruction = await this.instruction.updateItem(
      args,
      accounts,
      additionalArgs
    );
    return this.sendWithRetry(instruction, [], options);
  }
}

interface SendOptions {
  commitment: web3.Commitment;
  timeout?: number;
}

export class ItemClassWrapper implements ObjectWrapper<ItemClass, ItemProgram> {
  program: ItemProgram;
  key: web3.PublicKey;
  object: ItemClass;
  data: Buffer;

  constructor(args: {
    program: ItemProgram;
    key: web3.PublicKey;
    object: ItemClass;
    data: Buffer;
  }) {
    this.program = args.program;
    this.key = args.key;
    this.object = args.object;
    this.data = args.data;
  }
}

export async function getItemProgram(
  anchorWallet: NodeWallet | web3.Keypair,
  env: string,
  customRpcUrl: string
): Promise<ItemProgram> {
  return Program.Program.getProgramWithWallet(
    ItemProgram,
    anchorWallet as Wallet,
    env,
    customRpcUrl
  );
}
