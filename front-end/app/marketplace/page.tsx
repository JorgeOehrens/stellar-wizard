// 'use client';

// import React, { useState, useEffect } from 'react';
// import { useSearchParams } from 'next/navigation';
// import NFTCard, { NFTMetadata } from '@/components/NFTCard';
// import NFTDetailModal from '@/components/NFTDetailModal';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Badge } from '@/components/ui/badge';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { useNetwork } from '@/app/providers/NetworkProvider';
// import { Search, Filter, Grid, Heart, TrendingUp, Clock } from 'lucide-react';

// interface MarketplaceResponse {
//   nfts: NFTMetadata[];
//   total: number;
//   limit: number;
//   offset: number;
//   hasMore: boolean;
//   network: string;
// }

// type SortOption = 'newest' | 'oldest' | 'most_liked' | 'least_liked';

// const MarketplacePage: React.FC = () => {
//   const { network } = useNetwork();
//   const searchParams = useSearchParams();
//   const [nfts, setNfts] = useState<NFTMetadata[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [loadingMore, setLoadingMore] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [sortBy, setSortBy] = useState<SortOption>('newest');
//   const [selectedCollection, setSelectedCollection] = useState<string>('');
//   const [collections, setCollections] = useState<string[]>([]);

//   // Modal state
//   const [selectedNFT, setSelectedNFT] = useState<NFTMetadata | null>(null);
//   const [isModalOpen, setIsModalOpen] = useState(false);

//   // Pagination
//   const [currentPage, setCurrentPage] = useState(0);
//   const [hasMore, setHasMore] = useState(true);
//   const [total, setTotal] = useState(0);
//   const pageSize = 12;

//   // Fetch NFTs from API
//   const fetchNFTs = async (page: number = 0, append: boolean = false) => {
//     try {
//       if (page === 0) {
//         setLoading(true);
//       } else {
//         setLoadingMore(true);
//       }
//       setError(null);

//       const params = new URLSearchParams({
//         network: network.toLowerCase(),
//         limit: pageSize.toString(),
//         offset: (page * pageSize).toString()
//       });

//       if (selectedCollection) {
//         params.set('collection', selectedCollection);
//       }

//       const response = await fetch(`/api/nfts?${params}`);

//       if (!response.ok) {
//         throw new Error('Failed to fetch NFTs');
//       }

//       const data: MarketplaceResponse = await response.json();

//       // Apply client-side filtering and sorting since our API doesn't handle it yet
//       let filteredNFTs = data.nfts;

//       // Filter by search query
//       if (searchQuery.trim()) {
//         const query = searchQuery.toLowerCase();
//         filteredNFTs = filteredNFTs.filter(nft =>
//           nft.name.toLowerCase().includes(query) ||
//           nft.description?.toLowerCase().includes(query) ||
//           nft.collectionName?.toLowerCase().includes(query)
//         );
//       }

//       // Sort NFTs
//       filteredNFTs.sort((a, b) => {
//         switch (sortBy) {
//           case 'newest':
//             return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
//           case 'oldest':
//             return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
//           case 'most_liked':
//             return b.likes - a.likes;
//           case 'least_liked':
//             return a.likes - b.likes;
//           default:
//             return 0;
//         }
//       });

//       if (append) {
//         setNfts(prev => [...prev, ...filteredNFTs]);
//       } else {
//         setNfts(filteredNFTs);
//       }

//       setTotal(data.total);
//       setHasMore(data.hasMore);

//       // Extract unique collections
//       const uniqueCollections = Array.from(
//         new Set(data.nfts.map(nft => nft.collectionName).filter(Boolean))
//       );
//       setCollections(uniqueCollections);

//     } catch (err) {
//       console.error('Error fetching NFTs:', err);
//       setError(err instanceof Error ? err.message : 'Failed to load NFTs');
//     } finally {
//       setLoading(false);
//       setLoadingMore(false);
//     }
//   };

//   // Load more NFTs
//   const loadMore = () => {
//     if (!hasMore || loadingMore) return;
//     const nextPage = currentPage + 1;
//     setCurrentPage(nextPage);
//     fetchNFTs(nextPage, true);
//   };

//   // Handle search and filter changes
//   const handleSearch = () => {
//     setCurrentPage(0);
//     fetchNFTs(0, false);
//   };

//   const handleSortChange = (newSort: SortOption) => {
//     setSortBy(newSort);
//     // Re-sort current NFTs
//     const sortedNFTs = [...nfts].sort((a, b) => {
//       switch (newSort) {
//         case 'newest':
//           return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
//         case 'oldest':
//           return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
//         case 'most_liked':
//           return b.likes - a.likes;
//         case 'least_liked':
//           return a.likes - b.likes;
//         default:
//           return 0;
//       }
//     });
//     setNfts(sortedNFTs);
//   };

//   const handleCollectionChange = (collection: string) => {
//     setSelectedCollection(collection);
//     setCurrentPage(0);
//     fetchNFTs(0, false);
//   };

//   // NFT detail modal
//   const handleNFTClick = (nft: NFTMetadata) => {
//     setSelectedNFT(nft);
//     setIsModalOpen(true);
//   };

//   const closeModal = () => {
//     setIsModalOpen(false);
//     setSelectedNFT(null);
//   };

//   // Initial load
//   useEffect(() => {
//     fetchNFTs();
//   }, [network]);

//   // Handle URL params
//   useEffect(() => {
//     const collection = searchParams?.get('collection');
//     if (collection) {
//       setSelectedCollection(collection);
//     }
//   }, [searchParams]);

//   if (loading && nfts.length === 0) {
//     return (
//       <div className="container mx-auto px-4 py-8">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//           <p className="text-muted-foreground">Loading NFTs...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="container mx-auto px-4 py-8 space-y-8">
//       {/* Header */}
//       <div className="text-center space-y-4">
//         <h1 className="text-4xl font-bold">NFT Marketplace</h1>
//         <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
//           Discover, collect, and trade unique digital assets on the Stellar network
//         </p>
//         <Badge variant="outline" className="text-sm">
//           {network.toUpperCase()} Network
//         </Badge>
//       </div>

//       {/* Stats Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//         <Card>
//           <CardContent className="p-4 text-center">
//             <Grid className="h-8 w-8 mx-auto mb-2 text-blue-600" />
//             <p className="text-2xl font-bold">{total}</p>
//             <p className="text-sm text-muted-foreground">Total NFTs</p>
//           </CardContent>
//         </Card>
//         <Card>
//           <CardContent className="p-4 text-center">
//             <Heart className="h-8 w-8 mx-auto mb-2 text-red-500" />
//             <p className="text-2xl font-bold">{nfts.reduce((sum, nft) => sum + nft.likes, 0)}</p>
//             <p className="text-sm text-muted-foreground">Total Likes</p>
//           </CardContent>
//         </Card>
//         <Card>
//           <CardContent className="p-4 text-center">
//             <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
//             <p className="text-2xl font-bold">{collections.length}</p>
//             <p className="text-sm text-muted-foreground">Collections</p>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Search and Filters */}
//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <Filter className="h-5 w-5" />
//             Filter & Search
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           {/* Search */}
//           <div className="flex gap-2">
//             <Input
//               placeholder="Search NFTs by name, description, or collection..."
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
//               className="flex-1"
//             />
//             <Button onClick={handleSearch} disabled={loading}>
//               <Search className="h-4 w-4" />
//             </Button>
//           </div>

//           {/* Filters */}
//           <div className="flex flex-wrap gap-4">
//             {/* Sort */}
//             <div className="flex items-center gap-2">
//               <span className="text-sm font-medium">Sort:</span>
//               <div className="flex gap-1">
//                 {[
//                   { value: 'newest', label: 'Newest', icon: Clock },
//                   { value: 'most_liked', label: 'Most Liked', icon: Heart },
//                   { value: 'oldest', label: 'Oldest', icon: Clock },
//                   { value: 'least_liked', label: 'Least Liked', icon: Heart }
//                 ].map(({ value, label, icon: Icon }) => (
//                   <Button
//                     key={value}
//                     size="sm"
//                     variant={sortBy === value ? 'default' : 'outline'}
//                     onClick={() => handleSortChange(value as SortOption)}
//                     className="text-xs"
//                   >
//                     <Icon className="h-3 w-3 mr-1" />
//                     {label}
//                   </Button>
//                 ))}
//               </div>
//             </div>

//             {/* Collection Filter */}
//             {collections.length > 0 && (
//               <div className="flex items-center gap-2">
//                 <span className="text-sm font-medium">Collection:</span>
//                 <div className="flex gap-1 flex-wrap">
//                   <Button
//                     size="sm"
//                     variant={selectedCollection === '' ? 'default' : 'outline'}
//                     onClick={() => handleCollectionChange('')}
//                     className="text-xs"
//                   >
//                     All
//                   </Button>
//                   {collections.map(collection => (
//                     <Button
//                       key={collection}
//                       size="sm"
//                       variant={selectedCollection === collection ? 'default' : 'outline'}
//                       onClick={() => handleCollectionChange(collection)}
//                       className="text-xs"
//                     >
//                       {collection}
//                     </Button>
//                   ))}
//                 </div>
//               </div>
//             )}
//           </div>
//         </CardContent>
//       </Card>

//       {/* Error State */}
//       {error && (
//         <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
//           <CardContent className="p-4 text-center text-red-600 dark:text-red-400">
//             <p>{error}</p>
//             <Button
//               onClick={() => fetchNFTs()}
//               variant="outline"
//               size="sm"
//               className="mt-2"
//             >
//               Try Again
//             </Button>
//           </CardContent>
//         </Card>
//       )}

//       {/* NFT Grid */}
//       {nfts.length > 0 ? (
//         <>
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
//             {nfts.map((nft) => (
//               <NFTCard
//                 key={nft.id}
//                 nft={nft}
//                 onClick={handleNFTClick}
//               />
//             ))}
//           </div>

//           {/* Load More */}
//           {hasMore && (
//             <div className="text-center">
//               <Button
//                 onClick={loadMore}
//                 disabled={loadingMore}
//                 variant="outline"
//                 size="lg"
//               >
//                 {loadingMore ? (
//                   <>
//                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
//                     Loading more...
//                   </>
//                 ) : (
//                   'Load More NFTs'
//                 )}
//               </Button>
//             </div>
//           )}
//         </>
//       ) : (
//         !loading && (
//           <Card>
//             <CardContent className="p-8 text-center">
//               <Grid className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
//               <h3 className="text-lg font-semibold mb-2">No NFTs Found</h3>
//               <p className="text-muted-foreground mb-4">
//                 {searchQuery || selectedCollection
//                   ? 'Try adjusting your search or filters'
//                   : 'No NFTs are available in this marketplace yet'}
//               </p>
//               {(searchQuery || selectedCollection) && (
//                 <Button
//                   onClick={() => {
//                     setSearchQuery('');
//                     setSelectedCollection('');
//                     handleSearch();
//                   }}
//                   variant="outline"
//                 >
//                   Clear Filters
//                 </Button>
//               )}
//             </CardContent>
//           </Card>
//         )
//       )}

//       {/* NFT Detail Modal */}
//       <NFTDetailModal
//         nft={selectedNFT}
//         isOpen={isModalOpen}
//         onClose={closeModal}
//       />
//     </div>
//   );
// };

// export default MarketplacePage;