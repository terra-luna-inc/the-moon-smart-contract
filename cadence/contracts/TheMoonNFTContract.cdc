pub contract TheMoonNFTContract {

    // Path for the receiver capability
    pub let NFT_RECEIVER_PUBLIC_PATH: PublicPath
    // Path for the QueryMintedCollection
    pub let QUERY_MINTED_COLLECTION_PATH: PublicPath
    // Path for seller catalog capability
    pub let SELLER_CATALOG_PATH: PublicPath

    // Path for the nft collection resource
    pub let COLLECTION_STORAGE_PATH: StoragePath
    // Path for minter resource
    pub let MINTER_STORAGE_PATH: StoragePath
    // Path for platform seller resource
    pub let SINGLE_PLATFORM_SELLER_PATH: StoragePath
    // Path for AdminMintCollection resource
    pub let ADMIN_MINT_COLLECTION_PATH: StoragePath

    pub resource MoonNft {
        pub let id: UInt64
        pub let originalContentCreator: String
        pub let creatorId: Int32
        pub let mediaUrl : String
        pub let metadata: { String : String }

        init(
            _ initID: UInt64,
            _ mediaUrl: String ,
            creator originalContentCreator: String ,
            creatorId cId: Int32,
            metadata: { String : String }
        ) {
            self.id = initID
            self.mediaUrl = mediaUrl
            self.originalContentCreator = originalContentCreator
            self.metadata = metadata
            self.creatorId = cId
        }

        pub fun getData () : MoonNftData {
            return MoonNftData(
                self.id,
                self.mediaUrl,
                creator: self.originalContentCreator,
                creatorId: self.creatorId,
                metadata: self.metadata
            )
        }
    }

    pub struct MoonNftData {
        pub let id: UInt64?
        pub let originalContentCreator: String
        pub let creatorId: Int32
        pub let mediaUrl : String
        pub let metadata: { String : String }

        init (
            _ id: UInt64?,
            _ mediaUrl: String,
            creator originalContentCreator: String,
            creatorId cId: Int32,
            metadata: { String : String }
        ){
            self.id = id
            self.originalContentCreator = originalContentCreator
            self.mediaUrl = mediaUrl
            self.metadata = metadata
            self.creatorId = cId
        }
    }

    pub resource MoonNftPack {
        pub let id: UInt64
        pub let previewMediaUrl: String
        pub let pack : @{UInt64 : MoonNft}
        pub let title: String
        // made this optional in case we decide to mix nfts from different creators
        // into one pack
        pub let originalContentCreator: String?
        pub let creatorId: Int32?


        init (
            _ packId: UInt64,
            _ initialPack : @[MoonNft],
            _ previewMediaUrl: String,
            title: String,
            creator originalContentCreator : String?,
            creatorId : Int32?
        ) {
            self.originalContentCreator = originalContentCreator
            self.creatorId = creatorId
            self.id = packId
            self.previewMediaUrl = previewMediaUrl
            self.title = title

            self.pack <- {}

            while (initialPack.length > 0) {
                let nft <- initialPack.removeLast()
                let nullNft <- self.pack.insert(key: nft.id, <- nft)
                destroy nullNft
            }

            destroy initialPack
        }

        // TODO improve by generating the metadata in init, then storing as variable,
        // then simply return reference to metadata
        pub fun getData(): MoonNftPackData {
            let nftIds = self.pack.keys

            return MoonNftPackData(
                self.id,
                nftIds,
                self.previewMediaUrl,
                title: self.title,
                creator: self.originalContentCreator,
                creatorId: self.creatorId)
        }

        pub fun exportNftsFromPack() : @[MoonNft] {
            let exportPack: @[MoonNft] <- []

            for key in self.pack.keys {
                exportPack.append(<- self.pack.remove(key: key)!)
            }

            return <- exportPack
        }

        destroy () {
            destroy self.pack
        }
    }

    pub struct MoonNftPackData {
        pub let id: UInt64
        pub let previewMediaUrl: String
        pub let collectionNftIds : [UInt64]
        pub let title: String
        pub let creator: String?
        pub let creatorId: Int32?

        init(
            _ id: UInt64,
            _ nftIds: [UInt64],
            _ previewMediaUrl: String,
            title: String,
            creator: String?,
            creatorId: Int32?,
        ) {
            self.id = id
            self.creator = creator
            self.collectionNftIds = nftIds
            self.creatorId = creatorId
            self.previewMediaUrl = previewMediaUrl
            self.title = title
        }
    }

    pub resource MoonNftRelease {
        pub let id : String
        pub let packGroupings: @{ String : MoonNftPack}
        pub let packData: MoonNftPackData
        access(self) var price: Int

        init(
            id: String
            _ packGroupings: @{ String : MoonNftPack},
            _ packData: MoonNftPackData,
            price : Int
        ) {
            pre {
                price > 0 : "Price for Release must be greater than 0"
            }

            self.id = id
            self.packGroupings <- packGroupings
            self.packData = packData
            self.price = price
        }

        pub fun getData(): MoonNftReleaseData {
            return MoonNftReleaseData(
                self.id,
                self.packData.previewMediaUrl,
                title: self.packData.title,
                creator: self.packData.creator,
                creatorId: self.packData.creatorId,
                count: self.packGroupings.keys.length,
                price: self.price
            )
        }

        pub fun getPackIds(): [String] {
            return self.packGroupings.keys
        }

        pub fun withdrawPack(packId: String): @MoonNftPack {
            pre {
                self.packGroupings.containsKey(packId) : "Release does not contain pack with Id"
            }

            let pack <- self.packGroupings.remove(key: packId)!

            return <- pack
        }

        pub fun appendMorePacks(packUUID: String, pack: @MoonNftPack) {
            pre {
                self.packGroupings.containsKey(packUUID) : "Already have a pack within grouping with that UUID. Use a different UUID"
            }

            let nullPack <- self.packGroupings[packUUID] <- pack

            destroy nullPack
        }

        pub fun updatePrice(_ newPrice: Int) {
            self.price = newPrice
        }

        destroy() {
            destroy self.packGroupings
        }
    }

    pub struct MoonNftReleaseData {
        pub let id : String
        pub let previewMediaUrl: String
        pub let title: String
        pub let creator: String?
        pub let creatorId: Int32?
        pub let count : Int
        pub let price : Int

        init(
            _ id: String,
            _ previewMediaUrl: String,
            title: String,
            creator: String?,
            creatorId: Int32?,
            count: Int,
            price: Int
        ) {
            self.id = id
            self.previewMediaUrl = previewMediaUrl
            self.title = title
            self.creator = creator
            self.creatorId = creatorId
            self.count = count
            self.price = price
        }
    }

    pub resource interface NftReceiver {
        pub fun depositNft(token: @MoonNft)
        pub fun depositNfts(tokens: @[MoonNft])
        pub fun depositNftPack(pack: @MoonNftPack)
        pub fun nftIdExists(_ id: UInt64): Bool
        pub fun packIdExists(_ id: UInt64): Bool

        pub fun getNftIds(): [UInt64]
        pub fun getNftData(id: UInt64) : MoonNftData
        pub fun getAllNfts() : [MoonNftData]

        pub fun getNftPackIds(): [UInt64]
        pub fun getNftPackData(id: UInt64) : MoonNftPackData
        pub fun getAllNftPacks(): [MoonNftPackData]
    }

    pub resource Collection: NftReceiver {
        pub let ownedNFTs: @{UInt64: MoonNft}
        pub let ownedPacks: @{UInt64: MoonNftPack}

        pub let nftDataObjects: {UInt64: MoonNftData}
        pub let nftPackDataObjects: {UInt64: MoonNftPackData}

        init () {
            self.ownedNFTs <- {}
            self.ownedPacks <- {}

            self.nftDataObjects = {}
            self.nftPackDataObjects ={}
        }

        pub fun withdraw(withdrawID: UInt64): @MoonNft {
            let token <- self.ownedNFTs.remove(key: withdrawID)!

            return <-token
        }

        pub fun depositNft(token: @MoonNft) {
            let tokenData = token.getData()
            self.nftDataObjects[token.id] = tokenData
            self.ownedNFTs[token.id] <-! token
        }

        pub fun depositNfts(tokens: @[MoonNft]) {
            let nftData : [MoonNftData] = []

            while (tokens.length > 0) {
                let nft <- tokens.removeFirst()
                nftData.append(nft.getData())

                self.depositNft(token: <- nft)
            }

            destroy tokens;
            emit MoonNftBulkDeposit(data: nftData)
        }

        pub fun depositNftPack(pack: @MoonNftPack) {
            let packData = pack.getData()
            self.nftPackDataObjects[pack.id] = packData
            self.ownedPacks[pack.id] <-! pack

            emit NftUserDeposit(data: packData)
        }

        pub fun nftIdExists(_ id: UInt64): Bool {
            return self.ownedNFTs.containsKey(id) && self.nftDataObjects[id] != nil
        }

        pub fun packIdExists(_ id: UInt64): Bool {
            return self.ownedPacks.containsKey(id) && self.nftPackDataObjects[id] != nil
        }

        pub fun getNftIds(): [UInt64] {
            return self.ownedNFTs.keys
        }

        pub fun getNftData(id: UInt64) : MoonNftData {
            pre {
                self.nftIdExists(id) : "Token does not exist"
            }

            return self.nftDataObjects[id]!
        }

        pub fun getAllNfts() : [MoonNftData] {
            return self.nftDataObjects.values
        }

        pub fun getNftPackIds(): [UInt64] {
            return self.ownedPacks.keys
        }
        pub fun getNftPackData(id: UInt64) : MoonNftPackData {
            pre {
                self.packIdExists(id) : "Pack does not exist"
            }

            return self.nftPackDataObjects[id]!
        }

        pub fun getAllNftPacks(): [MoonNftPackData] {
            return self.nftPackDataObjects.values
        }

        pub fun withdrawNft(packId: UInt64) : @MoonNft {
            pre {
                self.nftIdExists(packId) : "Cannot withdraw NFT that doesn't exist in your collection"
            }

            self.nftDataObjects.remove(key: packId)
            return <- self.ownedNFTs.remove(key: packId)!
        }

        pub fun withdrawPack(packId: UInt64) : @MoonNftPack {
            pre {
                self.packIdExists(packId) : "Cannot withdraw pack that doesn't exist in your collection"
            }

            self.nftPackDataObjects.remove(key: packId)
            return <- self.ownedPacks.remove(key: packId)!
        }

        pub fun openNftPack (packId: UInt64) : [MoonNftData]{
            pre {
                self.packIdExists(packId) : "Cannot open pack that doesnt exist in your collection"
            }

            let pack <- self.withdrawPack(packId: packId)
            let packNfts <- pack.exportNftsFromPack()

            let nftData : [MoonNftData] = []

            while packNfts.length > 0 {
                let nft <- packNfts.removeFirst()
                nftData.append(nft.getData())
                self.depositNft(token: <- nft)
            }

            destroy pack
            destroy packNfts

            emit MoonNftPackOpened(data: nftData)

            return nftData
        }

        destroy() {
            destroy self.ownedNFTs
            destroy self.ownedPacks
        }
    }

    pub resource interface SellerCatalog {
        pub let nftsByCreatorId: {Int32: {UInt64 : MoonNftData}}
        pub let packReleasesByCreatorId: {Int32: {String : MoonNftReleaseData}}

        pub let nftsByCreator: {String: {UInt64 : MoonNftData}}
        pub let packReleasesByCreator: {String: {String : MoonNftReleaseData}}

        pub fun getAllPackReleases(): [MoonNftReleaseData]
        pub fun getTotalPackCount(): Int
        pub fun packReleaseExists(id: String): Bool

        pub fun getPackReleaseData(id: String): MoonNftReleaseData
        pub fun getNftData(id: UInt64): MoonNftData

        pub fun getCurrentPackIdsAvailableWithinRelease(id: String): [String]

        pub fun getDataForAllNfts(): [MoonNftData]
        pub fun getTotalNFTCount(): Int
        pub fun nftExists(id: UInt64): Bool
    }

    pub resource SinglePlatformSeller: SellerCatalog {
        pub let nftsForSale: @{UInt64 : MoonNft}
        pub let packReleasesForSale: @{String : MoonNftRelease}

        pub let nftsByCreatorId: {Int32: {UInt64 : MoonNftData}}
        pub let packReleasesByCreatorId: {Int32: {String : MoonNftReleaseData}}

        pub let nftsByCreator: {String: {UInt64 : MoonNftData}}
        pub let packReleasesByCreator: {String: {String : MoonNftReleaseData}}

        init() {
            self.packReleasesForSale <- {}
            self.nftsForSale <- {}

            self.nftsByCreatorId = {}
            self.packReleasesByCreatorId = {}

            self.nftsByCreator = {}
            self.packReleasesByCreator = {}
        }

        pub fun getAllPackReleases(): [MoonNftReleaseData] {
            let packs: [MoonNftReleaseData] = []

            for packId in self.packReleasesForSale.keys {
                let packsForSale: &{String : MoonNftRelease} = &self.packReleasesForSale as &{String : MoonNftRelease}
                let release: &MoonNftRelease = &packsForSale[packId] as &MoonNftRelease
                let packMetadata = release.getData()
                packs.append(packMetadata)
            }

            return packs
        }

        pub fun getCurrentPackIdsAvailableWithinRelease(id: String): [String] {
            pre {
                self.packReleaseExists(id: id) : "Release does not exist"
            }

            let packsForSale: &{String : MoonNftRelease} = &self.packReleasesForSale as &{String : MoonNftRelease}
            let release: &MoonNftRelease = &packsForSale[id] as &MoonNftRelease

            return release.getPackIds()
        }

        pub fun getTotalPackCount(): Int {
            return self.packReleasesForSale.keys.length
        }

        pub fun packReleaseExists(id: String ): Bool {
            return self.packReleasesForSale.containsKey(id)
        }

        pub fun getDataForAllNfts(): [MoonNftData] {
            let nfts: [MoonNftData] = []
            let nftsForSale: &{UInt64 : MoonNft} = &self.nftsForSale as &{UInt64 : MoonNft}

            for nftId in nftsForSale.keys {
                let nft: &MoonNft = &self.nftsForSale[nftId] as &MoonNft
                let nftData = nft.getData()
                nfts.append(nftData)
            }

            return nfts
        }

        pub fun getTotalNFTCount(): Int {
            return self.nftsForSale.keys.length
        }

        pub fun nftExists(id: UInt64 ): Bool {
            return self.nftsForSale.containsKey(id)
        }

        pub fun withdrawPack(id packId: String): @MoonNftRelease {
            pre {
                self.packReleaseExists(id: packId) : "Pack does not exist"
            }

            let release <- self.packReleasesForSale.remove(key: packId)!

            // remove pack from creatorIds map
            if (release.packData.creatorId != nil) {
                let creatorIdCollection = self.packReleasesByCreatorId[release.packData.creatorId!]
                creatorIdCollection?.remove(key: release.id)
            }

            // remove pack from creator map
            if (release.packData.creator != nil) {
                let creatorCollection = self.packReleasesByCreator[release.packData.creator!]
                creatorCollection?.remove(key: release.id)
            }

            return <- release
        }

        pub fun depositNft(_ nft: @MoonNft) {
            if (!self.nftsByCreator.containsKey(nft.originalContentCreator)) {
                self.nftsByCreator[nft.originalContentCreator] = {}
            }

            if (!self.nftsByCreatorId.containsKey(nft.creatorId)) {
                self.nftsByCreatorId[nft.creatorId] = {}
            }

            let creatorDic: &{UInt64 : MoonNftData} = &self.nftsByCreator[nft.originalContentCreator] as &{UInt64 : MoonNftData}
            let creatorIdDic: &{UInt64 : MoonNftData} = &self.nftsByCreatorId[nft.creatorId] as &{UInt64 : MoonNftData}

            creatorDic[nft.id] = nft.getData()
            creatorIdDic[nft.id] = nft.getData()

            let nullNft <- self.nftsForSale[nft.id] <- nft

            destroy  nullNft
        }

        pub fun depositRelease(_ pack: @MoonNftRelease) {
            if (pack.packData.creator != nil) {
                if (!self.packReleasesByCreator.containsKey(pack.packData.creator !)) {
                    self.packReleasesByCreator.insert(key: pack.packData.creator !, {})
                }

                let creatorCollection = &self.packReleasesByCreator[pack.packData.creator!] as &{String : MoonNftReleaseData}
                creatorCollection.insert(key: pack.id, pack.getData())
            }

            if (pack.packData.creatorId != nil) {
                if (!self.packReleasesByCreatorId.containsKey(pack.packData.creatorId!)) {
                    self.packReleasesByCreatorId.insert(key: pack.packData.creatorId!, {})
                }

                let creatorIdCollection = &self.packReleasesByCreatorId[pack.packData.creatorId!] as &{String : MoonNftReleaseData}
                creatorIdCollection.insert(key: pack.id, pack.getData())
            }

            let old <- self.packReleasesForSale.insert(key: pack.id, <- pack)

            // pack Ids are unique so we are guaranteed
            // not to be destroying an actual pack here
            destroy old
        }

        pub fun getPackReleaseData(id: String): MoonNftReleaseData {
            pre {
                self.packReleaseExists(id: id) : "Pack does not exist"
            }

            let packsForSale: &{String : MoonNftRelease} = &self.packReleasesForSale as &{String : MoonNftRelease}

            let release : &MoonNftRelease = &packsForSale[id] as &MoonNftRelease
            let data = release.getData()

            return data
        }

        pub fun getNftData(id: UInt64): MoonNftData {
            pre {
                self.nftExists(id: id) : "Pack does not exist"
            }

            let nftsForSale: &{UInt64 : MoonNft} = &self.nftsForSale as &{UInt64 : MoonNft}

            let nft : &MoonNft = &nftsForSale[id] as &MoonNft
            let data = nft.getData()

            return data
        }

        pub fun bulkDepositRelease(_ packs: @[MoonNftRelease]) {
            var i = 0
            while packs.length > 0  {
                let pack <- packs.removeFirst()
                self.depositRelease(<- pack)

                i = i + 1
            }

            destroy packs
        }

        pub fun bulkDepositNft(_ nfts: @[MoonNft]) {
            pre {
                false : "Not Implemented"
            }
            // TODO
            destroy nfts
        }

        destroy() {
            destroy self.packReleasesForSale
            destroy self.nftsForSale
        }
    }

    pub resource NftMinter {
        access(self) var nftIdCount: UInt64
        access(self) var packIdCount: UInt64

        init() {
            self.nftIdCount = 0
            self.packIdCount = 0
        }

        access(self) fun incrementNftIdCount() {
            self.nftIdCount = self.nftIdCount + 1 as UInt64
        }

        access(self) fun incrementPackIdCount() {
            self.packIdCount = self.packIdCount + 1 as UInt64
        }

        pub fun mintNFT (_ nftData: MoonNftData ): @MoonNft {
            self.incrementNftIdCount()
            var newNFT <- create MoonNft(
                self.nftIdCount,
                nftData.mediaUrl,
                creator: nftData.originalContentCreator,
                creatorId: nftData.creatorId,
                metadata: nftData.metadata
            )

            emit MoonNftMinted(data: newNFT.getData())
            return <-newNFT
        }

        pub fun bulkMintNft (_ nftsToMint: [MoonNftData]): @[MoonNft] {
            pre {
                nftsToMint.length > 0 : "[NftMinter] No NFT's that we can mint"
            }

            let mintedNfts : @[MoonNft] <- []

            for nftData in nftsToMint {
                let newNFT <- self.mintNFT(nftData)

                mintedNfts.append(<- newNFT)

            }

            return <- mintedNfts
        }

        pub fun createNftPack (_ packOfNfts: @[MoonNft], _ data: MoonNftPackData) : @MoonNftPack {
            self.incrementPackIdCount()
            let nftPack <- create MoonNftPack(
                self.packIdCount,
                <- packOfNfts,
                data.previewMediaUrl,
                title: data.title,
                creator: data.creator,
                creatorId: data.creatorId
            )

            emit MoonNftPackCreated(data: nftPack.getData())
            return <- nftPack
        }

        pub fun createNftPackRelease (id: String, _ packOfNfts: @{ String : [MoonNft]}, _ data: MoonNftPackData, price: Int) :@MoonNftRelease {
            let packGroupingMap : @{ String : MoonNftPack } <- {}

            for key in packOfNfts.keys {
                let nfts <- packOfNfts.remove(key: key)!
                let pack <- self.createNftPack(<- nfts, data)
                let nullNft <- packGroupingMap.insert(key: key, <- pack)
                destroy nullNft
            }

            destroy packOfNfts

            let release <- create MoonNftRelease(id: id, <- packGroupingMap, data, price: price)
            emit MoonNftPackGroupingCreated(data: release.getData())
            return <- release
        }
    }

    pub resource interface QueryMintedCollection {
        pub fun getAllGroups() : [NftGroupData]
        pub fun getGroupInfo(_ groupId: String) : NftGroupData
        pub fun getAllIds() : [UInt64]
    }

    pub resource AdminMintedCollection : QueryMintedCollection {
        pub let groupMetadata : {String : MoonNftData}
        pub let groupNftIds : { String : {UInt64 : UInt64} }
        pub let nfts : @{ UInt64 : MoonNft }

        pub let creatorToGroupMap : { String : String}
        pub let creatorIdToGroupMap : { Int32 : String }

        init () {
            self.groupMetadata = {}
            self.groupNftIds = {}
            self.nfts <- {}

            self.creatorToGroupMap = {}
            self.creatorIdToGroupMap = {}
        }

        pub fun depositGroup(_ groupId: String, _ groupMetadata: MoonNftData, _ nfts: @[MoonNft]){
            pre {
                nfts.length > 0 : "No NFT's to deposit"
            }

            self.groupMetadata[groupId] = groupMetadata
            var nftIds : {UInt64 : UInt64} = {}

            while nfts.length > 0 {
                let nft <- nfts.removeLast()
                nftIds.insert(key: nft.id, nft.id);

                let nullNft <- self.nfts[nft.id] <- nft

                destroy nullNft
            }

            self.groupNftIds[groupId] = nftIds
            self.creatorToGroupMap[groupMetadata.originalContentCreator] = groupId;
            self.creatorIdToGroupMap[groupMetadata.creatorId] = groupId;

            emit NftGroupDataCreated(data: self.getGroupInfo(groupId))

            destroy nfts
        }

        pub fun getAllIds() : [UInt64] {
            return self.nfts.keys
        }

        pub fun getAllGroups() : [NftGroupData]{
            let groupData: [NftGroupData] = []

            for groupId in self.groupNftIds.keys {
                groupData.append(self.getGroupInfo(groupId))
            }

            return groupData
        }

        pub fun getGroupInfo(_ groupId: String) : NftGroupData {
            pre {
                self.groupNftIds[groupId] != nil : "No Nfts associated with group"
                self.groupMetadata[groupId] != nil : "No Metadata associated with group"
            }

            let nftIdGroup = self.groupNftIds[groupId]!
            let nftIds = nftIdGroup.keys

            return NftGroupData(
                groupId,
                nftIds,
                self.groupMetadata[groupId]!
            )
        }

        pub fun pickNfts(_ groupIds: [String]) : @[MoonNft]{
            let pickedNfts : @[MoonNft] <- []

            while groupIds.length > 0 {
                let groupId = groupIds.removeFirst()
                let nftIds = self.groupNftIds[groupId] ?? panic("Group with Id ".concat(groupId).concat(" does not exist"))

                // remove the nft Id from the group so that we know it no longer exists in this grouping
                let nftId = nftIds.remove(key: nftIds.keys[0])!

                let nft <- self.nfts.remove(key: nftId)!
                pickedNfts.append(<- nft)

                // set groupIds to the newly removed array
                self.groupNftIds[groupId] = nftIds
            }

            return <- pickedNfts
        }

        destroy () {
            destroy self.nfts
        }
    }

    pub struct NftGroupData {
        pub let groupId : String
        pub let nftIds : [UInt64]
        pub let metadata : MoonNftData

        init (_ groupId: String, _ nftIds: [UInt64], _ metadata: MoonNftData) {
            self.groupId = groupId
            self.nftIds = nftIds
            self.metadata = metadata
        }
    }

    pub fun createEmptyCollection(): @Collection {
        return <- create Collection()
    }

    init() {
        self.NFT_RECEIVER_PUBLIC_PATH = /public/NftReceiver
        self.SELLER_CATALOG_PATH = /public/SellerCatalog
        self.QUERY_MINTED_COLLECTION_PATH = /public/QueryMintedCollection

        self.COLLECTION_STORAGE_PATH = /storage/MoonNFTCollection
        self.MINTER_STORAGE_PATH = /storage/NftMinter
        self.SINGLE_PLATFORM_SELLER_PATH = /storage/PlatformSeller
        self.ADMIN_MINT_COLLECTION_PATH = /storage/AdminMintedCollection

        // setup Minting and collecting infrastructure
        self.account.save(<- create Collection(), to: self.COLLECTION_STORAGE_PATH)
        self.account.link<&{NftReceiver}>(self.NFT_RECEIVER_PUBLIC_PATH, target: self.COLLECTION_STORAGE_PATH)
        self.account.save(<-create NftMinter(), to: self.MINTER_STORAGE_PATH)

        // setup seller infrastructure
        self.account.save(<- create SinglePlatformSeller(), to: self.SINGLE_PLATFORM_SELLER_PATH)
        self.account.link<&{SellerCatalog}>(self.SELLER_CATALOG_PATH, target: self.SINGLE_PLATFORM_SELLER_PATH)

        // setup admin mint collection resource
        self.account.save(<- create AdminMintedCollection(), to: self.ADMIN_MINT_COLLECTION_PATH)
        self.account.link<&{QueryMintedCollection}>(self.QUERY_MINTED_COLLECTION_PATH, target: self.ADMIN_MINT_COLLECTION_PATH)
    }

    pub event MoonNftMinted(data: MoonNftData)

    pub event MoonNftPackCreated(data: MoonNftPackData)

    pub event MoonNftPackGroupingCreated(data: MoonNftReleaseData)

    pub event NftUserDeposit(data: MoonNftPackData)

    pub event NftGroupDataCreated(data: NftGroupData)

    pub event MoonNftPackOpened(data: [MoonNftData])

    pub event MoonNftBulkDeposit(data: [MoonNftData])
}

