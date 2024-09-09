import React, { useState, useEffect } from "react";
import {
	Image,
	Text,
	ScrollView,
	View,
	Button,
	TextInput,
	Modal,
	ActivityIndicator,
	Alert,
	FlatList,
	TouchableOpacity,
} from "react-native";
import axios from "axios";
import { Buffer } from "buffer";
import * as ImagePicker from "expo-image-picker";

const CategoryPicker = ({ categories, onSelect, visible, onClose }) => {
	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={onClose}
		>
			<View
				style={{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					backgroundColor: "rgba(0,0,0,0.5)",
				}}
			>
				<View
					style={{
						width: 300,
						backgroundColor: "white",
						borderRadius: 10,
						padding: 20,
					}}
				>
					<Text>Select a category:</Text>
					<FlatList
						data={categories}
						keyExtractor={(item) => item}
						renderItem={({ item }) => (
							<TouchableOpacity
								onPress={() => {
									onSelect(item);
									onClose();
								}}
							>
								<Text style={{ padding: 10 }}>{item}</Text>
							</TouchableOpacity>
						)}
					/>
					<Button title="Cancel" onPress={onClose} />
				</View>
			</View>
		</Modal>
	);
};

interface ImageInterface {
	imageName: string;
	imageUrl: string;
	sha: string;
}
interface CategoryImage {
	categoryName: string;
	images: ImageInterface[];
}

interface CategoryType {
	name: string;
	path: string;
	sha: string;
	size: number;
	url: string;
	html_url: string;
	git_url: string;
	download_url: string;
	type: "dir";
	_links: {
		self: string;
		git: string;
		html: string;
	};
}

interface ImageType {
	name: string;
	path: string;
	sha: string;
	size: number;
	url: string;
	html_url: string;
	git_url: string;
	download_url: string;
	type: "file";
	_links: {
		self: string;
		git: string;
		html: string;
	};
}

export default function HomeScreen() {
	const [data, setData] = useState<CategoryImage[]>([]);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [newImageUrl, setNewImageUrl] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(
		null
	);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [imageToDelete, setImageToDelete] = useState<{
		categoryName: string;
		imageName: string;
		imageSha: string;
	} | null>(null);
	const [showUploadModal, setShowUploadModal] = useState(false);
	const [imageToUpload, setImageToUpload] = useState<{
		imageName: string;
		imageUrl: string;
	} | null>(null);
	const [loading, setLoading] = useState(false); // Индикатор загрузки

	useEffect(() => {
		fetchCategories();
	}, []);

	const pickImageFromGallery = async () => {
		// Запрашиваем разрешение на доступ к медиафайлам
		const { status } =
			await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== "granted") {
			alert("Необходимо разрешение на доступ к галерее!");
			return;
		}

		// Открываем галерею для выбора изображения
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [4, 3],
			quality: 1,
		});

		if (!result.canceled) {
			// Если изображение выбрано, его можно загрузить в выбранную категорию
			handleUploadImage(result.uri);
		}
	};

	const handleUploadImage = (imageUri) => {
		if (!selectedCategory) {
			alert("Пожалуйста, выберите категорию перед загрузкой");
			return;
		}

		// Здесь добавь логику для загрузки изображения в выбранную категорию
		console.log(
			"Загружается изображение:",
			imageUri,
			"в категорию:",
			selectedCategory
		);

		// Логика загрузки на сервер или в хранилище
	};

	const fetchCategories = async () => {
		try {
			setLoading(true); // Начинаем загрузку
			const username = "IvanOrlovsky";
			const reponame = "forged-dragon";
			const categoryPath = "public/category";
			const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

			const response = await axios.get(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			const categoryNames = response.data.map(
				(item: CategoryType) => item.name
			);

			const categories = await Promise.all(
				categoryNames.map(async (categoryName: string) => {
					const images = await fetchImages(categoryName);
					return { categoryName, images };
				})
			);

			setData(categories);
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при получении категорий");
			console.error("Ошибка при получении категорий:", error);
		} finally {
			setLoading(false); // Заканчиваем загрузку
		}
	};

	const fetchImages = async (
		categoryName: string
	): Promise<ImageInterface[]> => {
		try {
			const username = "IvanOrlovsky";
			const reponame = "forged-dragon";
			const categoryPath = `public/category/${categoryName}`;
			const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

			const response = await axios.get(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			const imageUrls = await Promise.all(
				response.data.map(async (image: ImageType) => {
					const imageResponse = await axios.get(image.git_url, {
						headers: {
							Authorization: `token ${token}`,
							Accept: "application/vnd.github.VERSION.raw",
						},
						responseType: "arraybuffer",
					});

					const base64Image = Buffer.from(
						imageResponse.data,
						"binary"
					).toString("base64");
					return {
						imageName: image.name,
						imageUrl: `data:image/webp;base64,${base64Image}`,
						sha: image.sha,
					};
				})
			);

			return imageUrls;
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при получении изображений");
			console.error("Ошибка при получении изображений:", error);
			return [];
		}
	};

	const addCategory = async () => {
		if (!newCategoryName) return;

		try {
			setLoading(true); // Начинаем загрузку
			const username = "IvanOrlovsky";
			const reponame = "forged-dragon";
			const categoryPath = `public/category/${newCategoryName}`;
			const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

			await axios.put(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}/.gitkeep`,
				{
					message: `Add new category ${newCategoryName}`,
					content: Buffer.from("").toString("base64"),
				},
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			Alert.alert("Успех", `Категория ${newCategoryName} добавлена`);
			setNewCategoryName("");
			fetchCategories();
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при добавлении категории");
			console.error("Ошибка при добавлении категории:", error);
		} finally {
			setLoading(false); // Заканчиваем загрузку
		}
	};

	const deleteCategory = async (categoryName: string) => {
		Alert.alert(
			"Подтверждение",
			`Вы уверены, что хотите удалить категорию ${categoryName}?`,
			[
				{
					text: "Отмена",
					style: "cancel",
				},
				{
					text: "Удалить",
					onPress: async () => {
						try {
							setLoading(true); // Начинаем загрузку
							const username = "IvanOrlovsky";
							const reponame = "forged-dragon";
							const categoryPath = `public/category/${categoryName}`;
							const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

							const response = await axios.get(
								`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
								{
									headers: {
										Authorization: `token ${token}`,
									},
								}
							);

							await Promise.all(
								response.data.map(async (file: ImageType) => {
									await axios.delete(
										`https://api.github.com/repos/${username}/${reponame}/contents/${file.path}`,
										{
											data: {
												message: `Delete file ${file.name}`,
												sha: file.sha,
											},
											headers: {
												Authorization: `token ${token}`,
											},
										}
									);
								})
							);

							setSelectedCategory(null);
							fetchCategories();
						} catch (error) {
							Alert.alert(
								"Ошибка",
								"Ошибка при удалении категории"
							);
							console.error(
								"Ошибка при удалении категории:",
								error
							);
						} finally {
							setLoading(false); // Заканчиваем загрузку
						}
					},
				},
			]
		);
	};

	const addImageToCategory = async () => {
		if (!selectedCategory || !newImageUrl) return;

		try {
			setLoading(true); // Начинаем загрузку
			const username = "IvanOrlovsky";
			const reponame = "forged-dragon";
			const categoryPath = `public/category/${selectedCategory}`;
			const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

			setShowUploadModal(true);
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при добавлении изображения");
			console.error("Ошибка при добавлении изображения:", error);
		} finally {
			setLoading(false); // Заканчиваем загрузку
		}
	};

	const handleConfirmUpload = async () => {
		if (!imageToUpload) return;

		try {
			setLoading(true); // Начинаем загрузку
			const username = "IvanOrlovsky";
			const reponame = "forged-dragon";
			const categoryPath = `public/category/${selectedCategory}/${imageToUpload.imageName}`;
			const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

			await axios.put(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
				{
					message: `Add image ${imageToUpload.imageName}`,
					content: imageToUpload.imageUrl.split(",")[1],
				},
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			Alert.alert(
				"Успех",
				`Изображение ${imageToUpload.imageName} загружено`
			);
			setNewImageUrl("");
			setSelectedCategory(null);
			fetchCategories();
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при загрузке изображения");
			console.error("Ошибка при загрузке изображения:", error);
		} finally {
			setLoading(false); // Заканчиваем загрузку
			setShowUploadModal(false);
		}
	};

	const deleteImage = async (
		categoryName: string,
		imageName: string,
		sha: string
	) => {
		Alert.alert(
			"Подтверждение",
			`Вы уверены, что хотите удалить изображение ${imageName}?`,
			[
				{ text: "Отмена", style: "cancel" },
				{
					text: "Удалить",
					onPress: async () => {
						try {
							setLoading(true); // Начинаем загрузку
							const username = "IvanOrlovsky";
							const reponame = "forged-dragon";
							const categoryPath = `public/category/${categoryName}/${imageName}`;
							const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
							await axios.delete(
								`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
								{
									data: {
										message: `Delete image ${imageName}`,
										sha: sha,
									},
									headers: {
										Authorization: `token ${token}`,
									},
								}
							);

							Alert.alert(
								"Успех",
								`Изображение ${imageName} удалено`
							);
							fetchCategories();
						} catch (error) {
							Alert.alert(
								"Ошибка",
								"Ошибка при удалении изображения"
							);
							console.error(
								"Ошибка при удалении изображения:",
								error
							);
						} finally {
							setLoading(false); // Заканчиваем загрузку
						}
					},
				},
			]
		);
	};

	return (
		<View style={{ flex: 1, padding: 20 }}>
			{loading && <ActivityIndicator size="large" color="#0000ff" />}
			<ScrollView>
				{data.map((category) => (
					<View
						key={category.categoryName}
						style={{ marginBottom: 20 }}
					>
						<Text style={{ fontSize: 18, fontWeight: "bold" }}>
							{category.categoryName}
						</Text>
						<ScrollView horizontal>
							{category.images.map((image) => (
								<View
									key={image.imageName}
									style={{ marginRight: 10 }}
								>
									<Image
										source={{ uri: image.imageUrl }}
										style={{ width: 100, height: 100 }}
										resizeMode="cover"
									/>
									<Button
										title="Удалить"
										color="red"
										onPress={() =>
											deleteImage(
												category.categoryName,
												image.imageName,
												image.sha
											)
										}
									/>
								</View>
							))}
						</ScrollView>
					</View>
				))}
			</ScrollView>
			<TextInput
				placeholder="Введите название категории"
				value={newCategoryName}
				onChangeText={setNewCategoryName}
				style={{
					height: 40,
					borderColor: "gray",
					borderWidth: 1,
					marginBottom: 10,
					paddingHorizontal: 10,
				}}
			/>
			<Button title="Добавить категорию" onPress={addCategory} />
			<TextInput
				placeholder="Введите URL изображения"
				value={newImageUrl}
				onChangeText={setNewImageUrl}
				style={{
					height: 40,
					borderColor: "gray",
					borderWidth: 1,
					marginBottom: 10,
					paddingHorizontal: 10,
				}}
			/>
			<Button
				title="Добавить изображение в категорию"
				onPress={addImageToCategory}
			/>
			<Button
				title="Выбрать изображение из галереи"
				onPress={pickImageFromGallery}
			/>
			<Picker
				selectedValue={selectedCategory}
				onValueChange={(itemValue) => setSelectedCategory(itemValue)}
				style={{ height: 50, width: 200 }}
			>
				{data.map((category) => (
					<Picker.Item
						key={category.categoryName}
						label={category.categoryName}
						value={category.categoryName}
					/>
				))}
			</Picker>

			{/* Модальное окно для подтверждения удаления изображения */}
			<Modal visible={showDeleteModal} transparent animationType="slide">
				<View
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						backgroundColor: "rgba(0,0,0,0.5)",
					}}
				>
					<View
						style={{
							width: 300,
							padding: 20,
							backgroundColor: "white",
							borderRadius: 10,
						}}
					>
						<Text>
							Вы уверены, что хотите удалить это изображение?
						</Text>
						<Button
							title="Удалить"
							onPress={handleConfirmUpload}
							color="red"
						/>
						<Button
							title="Отмена"
							onPress={() => setShowDeleteModal(false)}
						/>
					</View>
				</View>
			</Modal>
			{/* Модальное окно для подтверждения загрузки изображения */}
			<Modal visible={showUploadModal} transparent animationType="slide">
				<View
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						backgroundColor: "rgba(0,0,0,0.5)",
					}}
				>
					<View
						style={{
							width: 300,
							padding: 20,
							backgroundColor: "white",
							borderRadius: 10,
						}}
					>
						<Text>Вы хотите загрузить это изображение?</Text>
						<Button
							title="Загрузить"
							onPress={handleConfirmUpload}
						/>
						<Button
							title="Отмена"
							onPress={() => setShowUploadModal(false)}
						/>
					</View>
				</View>
			</Modal>
		</View>
	);
}
