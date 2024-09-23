import React, { useState, useEffect, useCallback, useRef } from "react";
import {
	Image,
	Text,
	View,
	Button,
	TextInput,
	Modal,
	ActivityIndicator,
	Alert,
	FlatList,
	TouchableOpacity,
	RefreshControl,
	StyleSheet,
	Dimensions,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import PagerView from "react-native-pager-view";

// Определение типов данных в соответствии с API
interface ImageInterface {
	original: string;
	thumbnail: string;
}

interface CategoryImage {
	tab: string;
	images: ImageInterface[];
}

interface ApiResponse {
	tabs: string[];
	imagesByTab: CategoryImage[];
}

export default function HomeScreen() {
	const [data, setData] = useState<CategoryImage[]>([]);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
	const [showSelectCategoryModal, setShowSelectCategoryModal] =
		useState(false);
	const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

	const [showRenameCategoryModal, setShowRenameCategoryModal] =
		useState(false);
	const [categoryToRename, setCategoryToRename] = useState("");
	const [newName, setNewName] = useState("");

	const [currentCategory, setCurrentCategory] = useState("");

	const baseUrl = "https://ivanorlovksy.ru/photo_api.php";
	const token = "your_fixed_token_here";

	const fetchCategories = useCallback(async () => {
		setLoading(true);
		try {
			const response = await axios.get<ApiResponse>(
				`${baseUrl}?action=getContentType`,
				{
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
						Authorization: token,
					},
				}
			);

			setData(response.data.imagesByTab);
		} catch (error) {
			console.error("Error fetching categories:", error);
			Alert.alert("Ошибка", "Ошибка при получении категорий");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchCategories();
	}, [fetchCategories]);

	const pickImageFromGallery = async (selectedCategory: string) => {
		const { status } =
			await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== "granted") {
			alert("Необходимо разрешение на доступ к галерее!");
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsMultipleSelection: true,
			aspect: [4, 3],
			quality: 1,
		});

		if (!result.canceled) {
			handleUploadImages(result.assets, selectedCategory);
		}
	};

	const handleUploadImages = async (
		images: ImagePicker.ImagePickerAsset[],
		selectedCategory: string
	) => {
		setUploading(true);
		let uploadedCount = 0;

		const uploadImage = async (image: ImagePicker.ImagePickerAsset) => {
			const formData = new FormData();
			formData.append("category", selectedCategory);
			formData.append("photo", {
				uri: image.uri,
				type: image.mimeType || "image/jpeg", // Используйте тип, если он доступен
				name: image.uri.split("/").pop(), // Берем имя из URI
			} as any);

			try {
				const uploadResponse = await axios.post(
					`${baseUrl}?action=uploadPhoto`,
					formData,
					{
						headers: {
							"Content-Type": "multipart/form-data",
							Authorization: token,
						},
					}
				);

				if (uploadResponse.data.success) {
					uploadedCount += 1;
				} else {
					throw new Error(
						`Error uploading image: ${uploadResponse.data.message}`
					);
				}
			} catch (uploadError) {
				console.error(`Error uploading image:`, uploadError);
				throw uploadError;
			}
		};

		try {
			for (const image of images) {
				await uploadImage(image);
			}
			Alert.alert("Успех", "Все изображения успешно загружены");
		} catch (error) {
			Alert.alert(
				"Ошибка",
				"Не удалось загрузить одно или несколько изображений"
			);
			console.error("Error handling image upload:", error);
		} finally {
			setUploading(false);
			await fetchCategories();
		}
	};

	const addCategory = async () => {
		if (!newCategoryName) {
			Alert.alert("Ошибка", "Нельзя давать пустое название категории");
			return;
		}

		setLoading(true);
		try {
			const response = await axios.post(
				`${baseUrl}?action=addCategory`,
				{ categoryName: newCategoryName },
				{
					headers: {
						Authorization: token,
					},
				}
			);

			if (response.data.success) {
				Alert.alert("Успех", `Категория ${newCategoryName} добавлена`);
				setNewCategoryName("");
				await fetchCategories();
			} else {
				throw new Error(response.data.error || "Неизвестная ошибка");
			}
		} catch (error) {
			Alert.alert("Ошибка", "Категория с таким именем уже есть");
			console.error("Error adding category:", error);
		} finally {
			setLoading(false);
			setShowAddCategoryModal(false);
		}
	};

	const deleteImage = async (categoryName: string, imageName: string) => {
		Alert.alert(
			"Подтверждение",
			`Вы уверены, что хотите удалить изображение ${imageName}?`,
			[
				{ text: "Отмена", style: "cancel" },
				{
					text: "Удалить",
					onPress: async () => {
						setLoading(true);
						try {
							const response = await axios.get(
								`${baseUrl}?action=deletePhoto&category=${categoryName}&filename=${imageName}`,
								{
									headers: {
										Authorization: token,
									},
								}
							);

							if (response.data.success) {
								await fetchCategories();
								Alert.alert(
									"Успех",
									`Изображение ${imageName} удалено`
								);
							} else {
								throw new Error(
									response.data.error || "Неизвестная ошибка"
								);
							}
						} catch (error) {
							Alert.alert(
								"Ошибка",
								"Ошибка при удалении изображения"
							);
							console.error(
								`Error deleting image ${imageName} from category ${categoryName}:`,
								error
							);
						} finally {
							setLoading(false);
						}
					},
				},
			]
		);
	};

	const deleteCategory = async (categoryName: string) => {
		Alert.alert(
			"Подтверждение",
			`Вы уверены, что хотите удалить категорию ${categoryName} и все её изображения?`,
			[
				{ text: "Отмена", style: "cancel" },
				{
					text: "Удалить",
					onPress: async () => {
						setLoading(true);
						try {
							const response = await axios.get(
								`${baseUrl}?action=deleteCategory&category=${categoryName}`,
								{
									headers: {
										Authorization: token,
									},
								}
							);

							if (response.data.success) {
								Alert.alert(
									"Успех",
									`Категория ${categoryName} и все её изображения удалены`
								);
								await fetchCategories();
							} else {
								throw new Error(
									response.data.error || "Неизвестная ошибка"
								);
							}
						} catch (error) {
							Alert.alert(
								"Ошибка",
								"Ошибка при удалении категории"
							);
							console.error(
								`Error deleting category ${categoryName}:`,
								error
							);
						} finally {
							setLoading(false);
						}
					},
				},
			]
		);
	};

	const renameCategory = async () => {
		if (!newName) {
			Alert.alert(
				"Ошибка",
				"Новое название категории не может быть пустым"
			);
			return;
		}

		setLoading(true);
		try {
			const response = await axios.get(
				`${baseUrl}?action=renameCategory&oldName=${categoryToRename}&newName=${newName}`,
				{
					headers: {
						Authorization: token,
					},
				}
			);

			if (response.data.success) {
				Alert.alert("Успех", `Категория переименована в ${newName}`);
				setNewName("");
				setCategoryToRename("");
				await fetchCategories();
			} else {
				throw new Error(response.data.error || "Неизвестная ошибка");
			}
		} catch (error) {
			Alert.alert("Ошибка", "Категория с таким именем уже есть");
			console.error("Error renaming category:", error);
		} finally {
			setLoading(false);
			setShowRenameCategoryModal(false);
		}
	};

	const onRefresh = useCallback(() => {
		setRefreshing(true);
		fetchCategories().finally(() => setRefreshing(false));
	}, [fetchCategories]);

	const renderCategoryImages = (category: CategoryImage) => {
		return (
			<View key={category.tab} style={styles.categoryContainer}>
				<Text style={styles.categoryTitle}>{category.tab}</Text>
				<Button
					title="Переименовать"
					onPress={() => {
						setNewName("");
						setCategoryToRename(category.tab);
						setShowRenameCategoryModal(true);
					}}
				/>
				<Button
					title="Удалить категорию"
					color="red"
					onPress={() => deleteCategory(category.tab)}
				/>
				<FlatList
					horizontal
					data={category.images}
					keyExtractor={(item) => item.thumbnail}
					renderItem={({ item }) => (
						<View style={styles.imageContainer}>
							<TouchableOpacity
								onPress={() => {
									setCurrentCategory(category.tab);
									setFullScreenImage(item.original);
								}}
							>
								<Image
									source={{
										uri: item.thumbnail,
									}}
									style={styles.image}
									resizeMode="cover"
								/>
							</TouchableOpacity>
							<Button
								title="Удалить"
								color="red"
								onPress={() =>
									deleteImage(
										category.tab,
										item.original.split("/").pop() || ""
									)
								}
							/>
						</View>
					)}
				/>
			</View>
		);
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Галерея категорий</Text>
			{loading || uploading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#0000ff" />
					<Text>
						{loading
							? "Загрузка данных сайта..."
							: "Загрузка изображений..."}
					</Text>
				</View>
			) : (
				<FlatList
					data={data}
					renderItem={({ item }) => renderCategoryImages(item)}
					keyExtractor={(item) => item.tab}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
						/>
					}
				/>
			)}

			<Button
				title="Добавить изображения"
				onPress={() => setShowSelectCategoryModal(true)}
			/>

			<Button
				title="Добавить категорию"
				onPress={() => setShowAddCategoryModal(true)}
			/>

			<Modal
				visible={!!fullScreenImage}
				transparent={true}
				onRequestClose={() => setFullScreenImage(null)}
			>
				<PagerView
					style={{
						flex: 1,
						alignSelf: "stretch",
						backgroundColor: "black",
					}}
					initialPage={
						data
							.find((data) => data.tab === currentCategory)
							?.images.findIndex(
								(image) => image.original === fullScreenImage
							) || 0
					}
				>
					{data
						.find((data) => data.tab === currentCategory)
						?.images.map((image, index) => (
							<View
								style={styles.fullScreenContainer}
								key={index}
							>
								<TouchableOpacity
									style={styles.fullScreenCloseButton}
									onPress={() => setFullScreenImage(null)}
								>
									<Text
										style={styles.fullScreenCloseButtonText}
									>
										Закрыть
									</Text>
								</TouchableOpacity>
								<Image
									source={{ uri: image.original }}
									style={styles.fullScreenImage}
									resizeMode="contain"
								/>
							</View>
						))}
				</PagerView>
			</Modal>

			<Modal
				visible={showAddCategoryModal}
				animationType="slide"
				onRequestClose={() => setShowAddCategoryModal(false)}
				transparent
			>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={styles.modalContainer}
				>
					<View style={styles.modalContent}>
						<Text>Введите название для новой категории:</Text>
						<TextInput
							value={newCategoryName}
							onChangeText={(text) =>
								setNewCategoryName(text.trim())
							}
							style={styles.input}
							autoFocus={true}
						/>
						<TouchableOpacity
							style={styles.button}
							onPress={addCategory}
						>
							<Text style={styles.buttonText}>Создать</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.button}
							onPress={() => setShowAddCategoryModal(false)}
						>
							<Text style={styles.buttonText}>Закрыть</Text>
						</TouchableOpacity>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			<Modal
				visible={showSelectCategoryModal}
				transparent
				animationType="slide"
			>
				<View style={styles.modalContainer}>
					<View style={styles.modalContent}>
						<Text>
							Выберите в какую категорию загрузить изображение:
						</Text>
						<FlatList
							data={data}
							keyExtractor={(item) => item.tab}
							renderItem={({ item }) => (
								<TouchableOpacity
									onPress={() => {
										pickImageFromGallery(item.tab);
										setShowSelectCategoryModal(false);
									}}
								>
									<Text style={styles.categorySelectText}>
										{item.tab}
									</Text>
								</TouchableOpacity>
							)}
						/>
						<TouchableOpacity
							style={styles.button}
							onPress={() => setShowSelectCategoryModal(false)}
						>
							<Text style={styles.buttonText}>Отмена</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			<Modal
				visible={showRenameCategoryModal}
				transparent
				animationType="slide"
				onRequestClose={() => setShowRenameCategoryModal(false)}
			>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={styles.modalContainer}
				>
					<View style={styles.modalContent}>
						<Text>Введите новое название для категории:</Text>
						<TextInput
							value={newName}
							onChangeText={(text) => setNewName(text.trim())}
							style={styles.input}
							placeholder={categoryToRename}
							autoFocus={true}
						/>
						<TouchableOpacity
							style={styles.button}
							onPress={renameCategory}
						>
							<Text style={styles.buttonText}>Переименовать</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.button}
							onPress={() => setShowRenameCategoryModal(false)}
						>
							<Text style={styles.buttonText}>Отмена</Text>
						</TouchableOpacity>
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		gap: 8,
		padding: 20,
		marginVertical: 40,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 10,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	categoryContainer: {
		marginBottom: 20,
		padding: 16,
		backgroundColor: "#C0C2C9",
		borderRadius: 16,
	},
	categoryTitle: {
		fontSize: 20,
		fontWeight: "bold",
		marginBottom: 10,
	},
	imageContainer: {
		marginTop: 15,
		flex: 1,
		gap: 4,
		marginRight: 10,
	},
	image: {
		width: 100,
		height: 100,
	},
	modalContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "rgba(0,0,0,0.5)",
	},
	modalContent: {
		width: 300,
		backgroundColor: "white",
		borderRadius: 10,
		padding: 20,
	},
	input: {
		borderWidth: 1,
		marginVertical: 10,
		padding: 5,
	},
	button: {
		borderWidth: 1,
		padding: 10,
		backgroundColor: "#4169E1",
		marginTop: 8,
	},
	buttonText: {
		color: "white",
		textAlign: "center",
	},
	categorySelectText: {
		padding: 10,
		fontWeight: "bold",
	},
	fullScreenContainer: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.9)", // Semi-transparent black
		justifyContent: "center",
		alignItems: "center",
	},
	fullScreenImage: {
		width: Dimensions.get("window").width,
		height: Dimensions.get("window").height,
	},
	fullScreenCloseButton: {
		position: "absolute",
		top: 40,
		right: 20,
		zIndex: 1,
		padding: 10,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		borderRadius: 5,
	},
	fullScreenCloseButtonText: {
		color: "white",
		fontSize: 16,
	},
});
